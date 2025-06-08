// =============================================================================
// TRUEVISION 3D RENDERING PIPELINE
// =============================================================================
//
// FILE       : RenderingPipeline_TrueVision3DCore.js
// NAMESPACE  : TrueVision3D.RenderingPipeline
// MODULE     : 3D Scene Creation and Rendering Management
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Manage Babylon.js scene creation, material processing, and render effects
// CREATED    : 2025
//
// DESCRIPTION:
// - Creates and configures complete 3D scene environment with lighting and skybox
// - Manages GLB model loading with error handling and progress indication
// - Processes and enhances material properties automatically based on naming conventions
// - Handles shadow generation and environmental setup for architectural visualization
// - Manages post-processing render effects including SSAO ambient occlusion
// - Provides scene configuration for optimal architectural presentation quality
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 2025 - Version 1.0.0
// - Initial Release
// - Babylon.js scene creation and configuration
// - Material auto-enhancement system implemented
// - Shadow generation and environmental setup
// - SSAO render effects integration
//
// =============================================================================

// Ensure TrueVision3D namespace exists
window.TrueVision3D = window.TrueVision3D || {};
window.TrueVision3D.RenderingPipeline = window.TrueVision3D.RenderingPipeline || {};

(function() {
'use strict';

// -----------------------------------------------------------------------------
// REGION | Rendering Pipeline Configuration Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | 3D Model Resource Configuration
    // ------------------------------------------------------------
    const MODEL_BASE_PATH              = "./Assets_PluginAssets/3DModels_GlbFormatModels/";                     // <-- Base path for all models
    const MODEL_NAME_PREFIX            = "TrueVision_-_Testing3D_-_PatterdaleCloseModel";                       // <-- Model name prefix
    
    // MODULE CONSTANTS | Segmented Model File Suffixes
    // ------------------------------------------------------------
    const MODEL_BUILDING_SUFFIX        = "_-_BuildingModel.glb";                                                // <-- Building model suffix
    const MODEL_GF_FURNITURE_SUFFIX    = "_-_GF_FurnishingsModel.glb";                                         // <-- Ground floor furniture suffix
    const MODEL_FF_FURNITURE_SUFFIX    = "_-_FF_FurnishingsModel.glb";                                         // <-- First floor furniture suffix
    // ---------------------------------------------------------------

    // MODULE CONSTANTS | Model Loading Configuration
    // ------------------------------------------------------------
    const VALIDATE_BUILDING_MODEL      = true;                                                                   // <-- Building model requires validation
    const FURNITURE_MODELS_OPTIONAL    = true;                                                                   // <-- Furniture models are optional
    // ---------------------------------------------------------------

    // MODULE CONSTANTS | Render Quality and Environment Settings
    // ------------------------------------------------------------
    const GROUND_OFFSET                = -0.5;                              // <-- Ground plane offset in metres
    const SHADOW_MAP_SIZE              = 2048;                               // <-- Shadow map resolution
    const SKYBOX_SIZE                  = 1000;                               // <-- Skybox dimensions
    const GROUND_SIZE                  = 1000;                               // <-- Ground plane dimensions
    // ---------------------------------------------------------------

    // MODULE CONSTANTS | Scene Visual Enhancement Settings
    // ------------------------------------------------------------
    const SCENE_EXPOSURE               = 1.5;                                // <-- Overall scene exposure
    const SCENE_CONTRAST               = 1.2;                                // <-- Scene contrast enhancement
    const SUN_LIGHT_INTENSITY          = 2.5;                                // <-- Primary sun light intensity
    const AMBIENT_LIGHT_INTENSITY      = 0.8;                                // <-- Ambient fill light intensity
    // ---------------------------------------------------------------

    // MODULE CONSTANTS | Render Effect Configuration
    // ------------------------------------------------------------
    const ENABLE_SSAO_DEFAULT          = true;                               // <-- Enable SSAO by default
    const SSAO_QUALITY_DEFAULT         = null;                               // <-- Auto-detect quality setting
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
    let modelsLoaded                   = {                                                                       // <-- Track loaded models
        building                       : false,
        groundFloorFurniture          : false,
        firstFloorFurniture           : false
    };
    let totalModelsToLoad              = 0;                                                                     // <-- Total number of models to load
    let modelsLoadedCount              = 0;                                                                     // <-- Current number of loaded models
    let furnitureMeshes                = [];                                                                    // <-- Array to store furniture mesh references
    let furnishingsVisible             = true;                                                                  // <-- Default furnishings visibility state
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Material Integration - CORRECTED HELPER FUNCTIONS
// -----------------------------------------------------------------------------

    // CRITICAL HELPER FUNCTION | Update Materials for HDRI Lighting Environment - CORRECTED
    // ---------------------------------------------------------------
    function updateMaterialsForHdri() {
        if (window.TrueVision3D?.MaterialLogic?.updateMaterialsForHdri) {
            const success = window.TrueVision3D.MaterialLogic.updateMaterialsForHdri();
            console.log("Materials updated for HDRI environment:", success ? "Success" : "Failed"); // <-- Add logging
            return success;                                                 // <-- Return result
        }
        console.warn("MaterialLogic.updateMaterialsForHdri not available"); // <-- Log warning
        return false;                                                       // <-- Return failure
    }
    // ---------------------------------------------------------------

    // CRITICAL HELPER FUNCTION | Restore Materials from HDRI to Standard Lighting - CORRECTED
    // ---------------------------------------------------------------
    function restoreMaterialsFromHdri() {
        if (window.TrueVision3D?.MaterialLogic?.restoreMaterialsFromHdri) {
            const success = window.TrueVision3D.MaterialLogic.restoreMaterialsFromHdri();
            console.log("Materials restored from HDRI environment:", success ? "Success" : "Failed"); // <-- Add logging
            return success;                                                 // <-- Return result
        }
        console.warn("MaterialLogic.restoreMaterialsFromHdri not available"); // <-- Log warning
        return false;                                                       // <-- Return failure
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Babylon.js Engine and Scene Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Babylon.js Engine with Enhanced Options
    // ------------------------------------------------------------
    function initializeBabylonEngine(canvasElement) {
        canvas = canvasElement;                                              // <-- Store canvas reference
        engine = new BABYLON.Engine(canvas, true, { 
            preserveDrawingBuffer: true, 
            stencil: true 
        });                                                                  // <-- Babylon.js engine with enhanced options
        
        // DISABLE BABYLON.JS DEFAULT LOADING SCREEN
        engine.loadingScreen = {
            displayLoadingUI: function () { },                               // <-- Empty display function
            hideLoadingUI: function () { }                                   // <-- Empty hide function
        };
        
        // HANDLE WINDOW RESIZE EVENTS
        window.addEventListener("resize", function () {
            engine.resize();                                                 // <-- Resize engine to match window
        });
        
        console.log("Babylon.js engine initialized successfully");           // <-- Log initialization success
        return engine;                                                       // <-- Return engine reference
    }
    // ---------------------------------------------------------------

    // FUNCTION | Create and Configure Complete 3D Scene Environment - ENHANCED
    // ------------------------------------------------------------
    function createScene() {
        scene = new BABYLON.Scene(engine);                                   // <-- Initialize new Babylon.js scene
        
        // ENHANCE SCENE VISUAL QUALITY AND BRIGHTNESS
        scene.imageProcessingConfiguration.exposure = SCENE_EXPOSURE;        // <-- Increase overall exposure
        scene.imageProcessingConfiguration.contrast = SCENE_CONTRAST;        // <-- Enhance contrast levels
        scene.imageProcessingConfiguration.toneMappingEnabled = true;        // <-- Enable tone mapping
        scene.clearColor = new BABYLON.Color4(0.94, 0.94, 0.94, 1);         // <-- Set light grey background
        
        createSceneLighting();                                               // <-- Configure sun and ambient lighting
        createSceneEnvironment();                                            // <-- Generate skybox and ground plane
        
        console.log("3D scene created and configured successfully");         // <-- Log scene creation success
        
        // CRITICAL: Initialize Material Logic Module with validation
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

    // SUB FUNCTION | Configure Scene Lighting System
    // ---------------------------------------------------------------
    function createSceneLighting() {
        // CREATE DIRECTIONAL LIGHT FOR SUN SIMULATION
        sunLight = new BABYLON.DirectionalLight("sunLight", 
            new BABYLON.Vector3(0, -1, 0), scene);                          // <-- Directional light pointing down
        sunLight.position = new BABYLON.Vector3(20, 40, 20);                // <-- Position in 3D space
        sunLight.intensity = SUN_LIGHT_INTENSITY;                            // <-- Light intensity value
        
        // CREATE AMBIENT HEMISPHERIC LIGHT FOR FILL LIGHTING
        let hemiLight = new BABYLON.HemisphericLight("hemiLight", 
            new BABYLON.Vector3(0, 1, 0), scene);                           // <-- Hemispheric light pointing up
        hemiLight.intensity = AMBIENT_LIGHT_INTENSITY;                       // <-- Ambient light intensity
        
        console.log("Scene lighting system configured");                     // <-- Log lighting setup
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Create Default Environment with Skybox and Ground
    // ---------------------------------------------------------------
    function createSceneEnvironment() {
        // CONFIGURE ENVIRONMENT OPTIONS
        let envOptions = {
            createSkybox: true,                                              // <-- Enable skybox creation
            skyboxSize: SKYBOX_SIZE,                                         // <-- Skybox dimensions
            skyboxColor: new BABYLON.Color3(0.75, 0.85, 0.95),              // <-- Light blue sky color
            createGround: true,                                              // <-- Enable ground plane
            groundSize: GROUND_SIZE,                                         // <-- Ground plane dimensions
            groundColor: new BABYLON.Color3(0.85, 0.87, 0.85)               // <-- Light grey ground color
        };
        
        sceneEnvironment = scene.createDefaultEnvironment(envOptions);       // <-- Create environment
        
        // CONFIGURE GROUND PLANE PROPERTIES
        if (sceneEnvironment.ground) {
            sceneEnvironment.ground.position.y += GROUND_OFFSET;             // <-- Apply ground offset
            sceneEnvironment.ground.receiveShadows = true;                   // <-- Enable shadow reception
        }
        
        // SETUP SHADOW GENERATION SYSTEM
        shadowGenerator = new BABYLON.ShadowGenerator(SHADOW_MAP_SIZE, sunLight); // <-- Create shadow generator
        shadowGenerator.useExponentialShadowMap = true;                      // <-- Use exponential shadow mapping
        
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
        
        console.log("Scene environment and shadow system configured");       // <-- Log environment setup
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | 3D Model Loading and Processing System - ENHANCED FOR SEGMENTED MODELS
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
        
        // THEN check if HDRI is active and update materials accordingly
        const hdriLogic = window.TrueVision3D?.SceneConfig?.HdriLightingLogic;
        if (hdriLogic && hdriLogic.getHdriState && hdriLogic.getHdriState().enabled) {
            setTimeout(() => {                                               // <-- Small delay to ensure materials are applied
                updateMaterialsForHdri();                                    // <-- Update materials for HDRI environment
            }, 100);
        }
    }
    // ---------------------------------------------------------------

    // NEW FUNCTION | Handle Camera Agent Markers Based on Configuration
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

    // SUB FUNCTION | Load Single Model Segment
    // ------------------------------------------------------------
    function loadModelSegment(modelPath, modelType, isRequired) {
        return new Promise((resolve, reject) => {
            console.log(`Loading ${modelType} model: ${modelPath}`);                                            // <-- Log model loading attempt
            
            // STORE INITIAL MESH COUNT
            const meshCountBefore = scene.meshes.length;                                                        // <-- Count meshes before loading
            
            BABYLON.SceneLoader.Append("", modelPath, scene, 
                function () {                                                                                    // <-- Success callback function
                    modelsLoadedCount++;                                                                         // <-- Increment loaded count
                    modelsLoaded[modelType] = true;                                                             // <-- Mark model as loaded
                    
                    // TRACK FURNITURE MESHES
                    if (modelType === "groundFloorFurniture" || modelType === "firstFloorFurniture") {
                        const meshCountAfter = scene.meshes.length;                                             // <-- Count meshes after loading
                        const newMeshes = scene.meshes.slice(meshCountBefore, meshCountAfter);                  // <-- Get newly added meshes
                        
                        // ADD NEW MESHES TO FURNITURE ARRAY
                        newMeshes.forEach(mesh => {
                            furnitureMeshes.push(mesh);                                                         // <-- Store furniture mesh reference
                            mesh.isVisible = furnishingsVisible;                                                // <-- Set initial visibility
                        });
                        
                        console.log(`✅ Added ${newMeshes.length} furniture meshes from ${modelType}`);
                    }
                    
                    console.log(`✅ ${modelType} model loaded successfully (${modelsLoadedCount}/${totalModelsToLoad})`);
                    
                    // UPDATE LOADING PROGRESS
                    if (loadingOverlay) {
                        const progressPercent = (modelsLoadedCount / totalModelsToLoad) * 100;
                        console.log(`Overall loading progress: ${progressPercent.toFixed(0)}%`);
                    }
                    
                    resolve(true);                                                                               // <-- Resolve promise
                }, 
                function (event) {                                                                               // <-- Progress callback function
                    if (event.lengthComputable) {
                        const progress = (event.loaded / event.total) * 100;
                        console.log(`${modelType} loading progress: ${progress.toFixed(1)}%`);                   // <-- Log progress
                    }
                },
                function (scene, message, exception) {                                                           // <-- Error callback function
                    console.error(`Error loading ${modelType} model:`, message, exception);                     // <-- Log error details
                    
                    if (isRequired) {
                        reject(new Error(`Failed to load required ${modelType} model: ${message}`));            // <-- Reject if required
                    } else {
                        console.warn(`⚠️ Optional ${modelType} model not found, continuing...`);                // <-- Warn if optional
                        modelsLoadedCount++;                                                                     // <-- Still increment count
                        resolve(false);                                                                          // <-- Resolve with false
                    }
                }
            );
        });
    }
    // ---------------------------------------------------------------

    // FUNCTION | Load All Segmented Models in Sequence
    // ------------------------------------------------------------
    async function loadSegmentedModels() {
        if (loadingOverlay) loadingOverlay.classList.remove("hidden");                                          // <-- Show loading overlay
        if (errorMessage) errorMessage.style.display = "none";                                                  // <-- Hide error message
        
        try {
            // RESET LOADING STATE
            modelsLoadedCount = 0;                                                                               // <-- Reset counter
            totalModelsToLoad = 3;                                                                               // <-- We have 3 models to attempt loading
            
            // CONSTRUCT MODEL PATHS
            const buildingModelPath = MODEL_BASE_PATH + MODEL_NAME_PREFIX + MODEL_BUILDING_SUFFIX;               // <-- Building model path
            const gfFurnitureModelPath = MODEL_BASE_PATH + MODEL_NAME_PREFIX + MODEL_GF_FURNITURE_SUFFIX;        // <-- Ground floor furniture path
            const ffFurnitureModelPath = MODEL_BASE_PATH + MODEL_NAME_PREFIX + MODEL_FF_FURNITURE_SUFFIX;        // <-- First floor furniture path
            
            console.log("=== STARTING SEGMENTED MODEL LOADING ===");
            console.log("Building Model:", buildingModelPath);
            console.log("GF Furniture Model:", gfFurnitureModelPath);
            console.log("FF Furniture Model:", ffFurnitureModelPath);
            
            // LOAD BUILDING MODEL FIRST (REQUIRED)
            const buildingLoaded = await loadModelSegment(buildingModelPath, "building", VALIDATE_BUILDING_MODEL);
            
            if (!buildingLoaded && VALIDATE_BUILDING_MODEL) {
                throw new Error("Building model is required but failed to load");                               // <-- Throw error if required model fails
            }
            
            // LOAD GROUND FLOOR FURNITURE (OPTIONAL)
            await loadModelSegment(gfFurnitureModelPath, "groundFloorFurniture", !FURNITURE_MODELS_OPTIONAL);
            
            // LOAD FIRST FLOOR FURNITURE (OPTIONAL)
            await loadModelSegment(ffFurnitureModelPath, "firstFloorFurniture", !FURNITURE_MODELS_OPTIONAL);
            
            // PROCESS ALL LOADED MESHES
            processLoadedMeshes();                                                                               // <-- Apply materials and shadows
            
            console.log("=== SEGMENTED MODEL LOADING COMPLETE ===");
            console.log("Models loaded:", modelsLoaded);
            
            if (loadingOverlay) loadingOverlay.classList.add("hidden");                                         // <-- Hide loading overlay
            
        } catch (error) {
            console.error("Fatal error during model loading:", error);                                          // <-- Log fatal error
            if (loadingOverlay) loadingOverlay.classList.add("hidden");                                         // <-- Hide loading overlay
            if (errorMessage) {
                errorMessage.style.display = "block";                                                           // <-- Show error message
                errorMessage.textContent = error.message || "Failed to load 3D models";                         // <-- Set error text
            }
        }
    }
    // ---------------------------------------------------------------

    // DEPRECATED FUNCTION | Load Single Model (Kept for backward compatibility)
    // ------------------------------------------------------------
    function loadThreeDModel() {
        console.warn("loadThreeDModel is deprecated. Using loadSegmentedModels instead.");                      // <-- Deprecation warning
        loadSegmentedModels();                                                                                  // <-- Call new function
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Material Processing and Enhancement System
// -----------------------------------------------------------------------------

    // FUNCTION | Automatically Detect and Enhance Material Properties - ENHANCED
    // ------------------------------------------------------------
    function applyAutoMaterials() {
        if (window.TrueVision3D?.MaterialLogic?.applyAutoMaterials) {
            const success = window.TrueVision3D.MaterialLogic.applyAutoMaterials();
            console.log("Auto materials applied:", success ? "Success" : "Failed"); // <-- Add logging
            return success;                                                 // <-- Return result
        } else {
            console.error("❌ MaterialLogic.applyAutoMaterials not available");
            return false;                                                   // <-- Return failure
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Render Effects Initialization and Management
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Post-Processing Render Effects
    // ------------------------------------------------------------
    function initializeRenderEffects(camera) {
        activeCamera = camera;                                               // <-- Store active camera reference
        
        // INITIALIZE SSAO AMBIENT OCCLUSION EFFECT
        if (ssaoEnabled && window.TrueVision3D && window.TrueVision3D.RenderEffects) {
            const ssaoEffect = window.TrueVision3D.RenderEffects.SsaoAmbientOcclusionEffect;
            if (ssaoEffect) {
                const initialized = ssaoEffect.initialize(scene, activeCamera, SSAO_QUALITY_DEFAULT);
                if (initialized) {
                    console.log("SSAO effect initialized successfully");     // <-- Log success
                } else {
                    console.warn("SSAO effect failed to initialize");       // <-- Log failure
                    ssaoEnabled = false;                                     // <-- Disable if failed
                }
            }
        }
        
        return ssaoEnabled;                                                  // <-- Return SSAO state
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Toggle SSAO Effect On/Off
    // ---------------------------------------------------------------
    function toggleSSAO() {
        const ssaoEffect = window.TrueVision3D?.RenderEffects?.SsaoAmbientOcclusionEffect;
        if (!ssaoEffect) return false;                                       // <-- Exit if not available
        
        ssaoEnabled = !ssaoEnabled;                                          // <-- Toggle state
        ssaoEffect.setEnabled(ssaoEnabled);                                  // <-- Apply state change
        
        console.log("SSAO " + (ssaoEnabled ? "enabled" : "disabled"));      // <-- Log state change
        return ssaoEnabled;                                                  // <-- Return new state
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Camera Switch for SSAO Update
    // ---------------------------------------------------------------
    function updateSSAOCamera(newCamera) {
        const ssaoEffect = window.TrueVision3D?.RenderEffects?.SsaoAmbientOcclusionEffect;
        if (!ssaoEffect || !ssaoEnabled) return;                            // <-- Exit if not needed
        
        activeCamera = newCamera;                                            // <-- Update active camera reference
        
        // USE EFFICIENT CAMERA UPDATE METHOD
        if (ssaoEffect.updateCamera) {                                       // <-- Check if method exists
            ssaoEffect.updateCamera(activeCamera);                          // <-- Update camera efficiently
            console.log("SSAO camera updated for new navigation mode");     // <-- Log update
        } else {
            console.warn("SSAO updateCamera method not available");         // <-- Log warning if missing
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
            if (scene && scene.activeCamera) {                              // <-- Check scene and camera exist
                scene.render();                                              // <-- Render frame
            }
        });
        
        console.log("Render loop started");                                  // <-- Log render loop start
    }
    // ---------------------------------------------------------------

    // FUNCTION | Stop Render Loop and Clean Up Resources
    // ---------------------------------------------------------------
    function stopRenderLoop() {
        if (engine) {
            engine.stopRenderLoop();                                         // <-- Stop the render loop
            console.log("Render loop stopped");                             // <-- Log render loop stop
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
        furnishingsVisible = !furnishingsVisible;                                                               // <-- Toggle visibility state
        
        // UPDATE VISIBILITY FOR ALL FURNITURE MESHES
        furnitureMeshes.forEach(mesh => {
            if (mesh && !mesh.isDisposed()) {                                                                   // <-- Check mesh is valid
                mesh.isVisible = furnishingsVisible;                                                            // <-- Set visibility
            }
        });
        
        console.log(`Furnishings ${furnishingsVisible ? 'shown' : 'hidden'} (${furnitureMeshes.length} meshes)`);
        return furnishingsVisible;                                                                               // <-- Return new state
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Current Furnishings Visibility State
    // ------------------------------------------------------------
    function getFurnishingsVisibility() {
        return furnishingsVisible;                                                                               // <-- Return current state
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Furnishings Visibility
    // ------------------------------------------------------------
    function setFurnishingsVisibility(visible) {
        furnishingsVisible = visible;                                                                            // <-- Set visibility state
        
        // UPDATE VISIBILITY FOR ALL FURNITURE MESHES
        furnitureMeshes.forEach(mesh => {
            if (mesh && !mesh.isDisposed()) {                                                                   // <-- Check mesh is valid
                mesh.isVisible = furnishingsVisible;                                                            // <-- Set visibility
            }
        });
        
        console.log(`Furnishings set to ${furnishingsVisible ? 'visible' : 'hidden'}`);
        return furnishingsVisible;                                                                               // <-- Return state
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Public API Interface for Rendering Pipeline
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Complete Rendering Pipeline
    // ------------------------------------------------------------
    function initialize(canvasElement, loadingElement, errorElement) {
        // STORE UI ELEMENT REFERENCES
        loadingOverlay = loadingElement;                                                                         // <-- Store loading overlay reference
        errorMessage = errorElement;                                                                             // <-- Store error message reference
        
        // INITIALIZE BABYLON.JS ENGINE
        initializeBabylonEngine(canvasElement);                                                                  // <-- Initialize engine with canvas
        
        // CREATE AND CONFIGURE SCENE
        createScene();                                                                                           // <-- Create complete 3D scene
        
        // LOAD SEGMENTED 3D MODELS
        loadSegmentedModels();                                                                                   // <-- Load segmented models
        
        console.log("Rendering pipeline initialized successfully");                                              // <-- Log initialization success
        return { engine: engine, scene: scene, sunLight: sunLight };                                            // <-- Return core references
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Core Rendering System References
    // ------------------------------------------------------------
    function getCoreReferences() {
        return {
            engine: engine,                                                  // <-- Babylon.js engine reference
            scene: scene,                                                    // <-- Babylon.js scene reference
            sunLight: sunLight,                                              // <-- Sun light reference
            shadowGenerator: shadowGenerator,                                // <-- Shadow generator reference
            canvas: canvas                                                   // <-- Canvas element reference
        };
    }
    // ---------------------------------------------------------------

    // FUNCTION | Start Rendering and Initialize Effects
    // ------------------------------------------------------------
    function startRendering(camera) {
        initializeRenderEffects(camera);                                     // <-- Initialize render effects
        startRenderLoop();                                                   // <-- Start continuous rendering
        
        return ssaoEnabled;                                                  // <-- Return SSAO state
    }
    // ---------------------------------------------------------------

    // FUNCTION | Cleanup Rendering Pipeline Resources
    // ------------------------------------------------------------
    function dispose() {
        // STOP RENDER LOOP
        stopRenderLoop();                                                    // <-- Stop rendering
        
        // CLEANUP SSAO EFFECT
        const ssaoEffect = window.TrueVision3D?.RenderEffects?.SsaoAmbientOcclusionEffect;
        if (ssaoEffect) {
            ssaoEffect.dispose();                                            // <-- Clean up SSAO resources
        }
        
        // CLEANUP HDRI LIGHTING
        const hdriLogic = window.TrueVision3D?.SceneConfig?.HdriLightingLogic;
        if (hdriLogic) {
            hdriLogic.dispose();                                             // <-- Clean up HDRI resources
        }
        
        // CLEANUP BABYLON ENGINE
        if (engine) {
            engine.dispose();                                                // <-- Clean up Babylon engine
        }
        
        // CLEAR REFERENCES
        canvas = null;                                                       // <-- Clear canvas reference
        engine = null;                                                       // <-- Clear engine reference
        scene = null;                                                        // <-- Clear scene reference
        sunLight = null;                                                     // <-- Clear light reference
        shadowGenerator = null;                                              // <-- Clear shadow generator
        sceneEnvironment = null;                                             // <-- Clear environment reference
        
        console.log("Rendering pipeline disposed");                          // <-- Log disposal
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Export and Public Interface
// -----------------------------------------------------------------------------

    // EXPOSE PUBLIC API
    window.TrueVision3D.RenderingPipeline = {
        initialize: initialize,                                              // <-- Initialize function
        getCoreReferences: getCoreReferences,                                // <-- Get references function
        startRendering: startRendering,                                      // <-- Start rendering function
        toggleSSAO: toggleSSAO,                                              // <-- Toggle SSAO function
        updateSSAOCamera: updateSSAOCamera,                                  // <-- Update SSAO camera function
        updateMaterialsForHdri: updateMaterialsForHdri,                      // <-- CRITICAL: Update materials for HDRI
        restoreMaterialsFromHdri: restoreMaterialsFromHdri,                  // <-- CRITICAL: Restore materials from HDRI
        toggleFurnishings: toggleFurnishings,                                // <-- Toggle furnishings visibility
        getFurnishingsVisibility: getFurnishingsVisibility,                  // <-- Get furnishings visibility state
        setFurnishingsVisibility: setFurnishingsVisibility,                  // <-- Set furnishings visibility
        dispose: dispose                                                     // <-- Cleanup function
    };

// endregion -------------------------------------------------------------------

})(); 