// =============================================================================
// VALEDESIGNSUITE - TRUEVISION 3D RENDERING PIPELINE
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
    const MODEL_URL                    = "https://www.noble-architecture.com/na-project-portal/25-Projects/SB03_-_Patterdale-Close/21_TrueVision_-_App-Content/SB03_-_TrueVision-GlbModel.glb"; 
    // ---------------------------------------------------------------

    // MODULE CONSTANTS | Render Quality and Environment Settings
    // ------------------------------------------------------------
    const GROUND_OFFSET                = -1.25;                              // <-- Ground plane offset in metres
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

    // FUNCTION | Create and Configure Complete 3D Scene Environment
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
        
        console.log("Scene environment and shadow system configured");       // <-- Log environment setup
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | 3D Model Loading and Processing System
// -----------------------------------------------------------------------------

    // FUNCTION | Load and Process 3D Model with Error Handling
    // ------------------------------------------------------------
    function loadThreeDModel() {
        if (loadingOverlay) loadingOverlay.classList.remove("hidden");      // <-- Show loading overlay
        if (errorMessage) errorMessage.style.display = "none";              // <-- Hide error message
        
        BABYLON.SceneLoader.Append("", MODEL_URL, scene, 
            function () {                                                    // <-- Success callback function
                if (loadingOverlay) loadingOverlay.classList.add("hidden"); // <-- Hide loading overlay
                
                // ADD ALL MESHES TO SHADOW CASTING SYSTEM
                scene.meshes.forEach(function (mesh) {
                    if (mesh !== sceneEnvironment.ground) {                  // <-- Exclude ground from shadows
                        shadowGenerator.addShadowCaster(mesh, true);         // <-- Add mesh to shadow system
                    }
                });
                
                applyAutoMaterials();                                        // <-- Process and enhance materials
                console.log("3D model loaded and processed successfully");   // <-- Log success
            }, 
            function (event) {                                               // <-- Progress callback function
                if (event.lengthComputable) {
                    const progress = (event.loaded / event.total) * 100;
                    console.log("Model loading progress: " + progress.toFixed(1) + "%"); // <-- Log progress
                }
            },
            function (scene, message, exception) {                           // <-- Error callback function
                console.error("Error loading model:", message, exception);   // <-- Log error details
                if (loadingOverlay) loadingOverlay.classList.add("hidden"); // <-- Hide loading overlay
                if (errorMessage) errorMessage.style.display = "block";     // <-- Show error message
            }
        );
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Material Processing and Enhancement System
// -----------------------------------------------------------------------------

    // FUNCTION | Automatically Detect and Enhance Material Properties
    // ------------------------------------------------------------
    function applyAutoMaterials() {
        let materialsProcessed = 0;                                          // <-- Counter for processed materials
        
        scene.materials.forEach(function (mat) {                             // <-- Iterate through all materials
            let name = mat.name.toLowerCase();                               // <-- Get lowercase material name
            let wasModified = false;                                         // <-- Track if material was modified
            
            // APPLY GENERAL PBR MATERIAL ENHANCEMENTS
            if (mat instanceof BABYLON.PBRMaterial) {
                mat.backFaceCulling = false;                                 // <-- Disable backface culling
                wasModified = true;                                          // <-- Mark as modified
            }
            
            // DETECT AND ENHANCE GLASS MATERIALS
            if (name.indexOf("glass") !== -1) {                             // <-- Check for glass in name
                if (mat instanceof BABYLON.PBRMaterial) {
                    mat.alpha = 0.5;                                         // <-- Set transparency level
                    mat.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND; // <-- Enable alpha blending
                    mat.reflectivityColor = new BABYLON.Color3(0.9, 0.9, 0.9); // <-- High reflectivity
                    mat.albedoColor = new BABYLON.Color3(0.8, 0.8, 0.9);    // <-- Slight blue tint
                    wasModified = true;                                      // <-- Mark as modified
                    console.log("Enhanced glass material: " + mat.name);     // <-- Log enhancement
                }
            }
            // DETECT AND ENHANCE METAL MATERIALS
            else if (name.indexOf("metal") !== -1 || name.indexOf("steel") !== -1 || name.indexOf("aluminium") !== -1) {
                if (mat instanceof BABYLON.PBRMaterial) {
                    mat.metallic = 1.0;                                      // <-- Full metallic property
                    mat.roughness = 0.2;                                     // <-- Low roughness for shine
                    wasModified = true;                                      // <-- Mark as modified
                    console.log("Enhanced metal material: " + mat.name);     // <-- Log enhancement
                }
            }
            
            if (wasModified) materialsProcessed++;                          // <-- Increment counter if modified
        });
        
        console.log("Material enhancement complete. " + materialsProcessed + " materials processed"); // <-- Log summary
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
// REGION | Public API Interface for Rendering Pipeline
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Complete Rendering Pipeline
    // ------------------------------------------------------------
    function initialize(canvasElement, loadingElement, errorElement) {
        // STORE UI ELEMENT REFERENCES
        loadingOverlay = loadingElement;                                     // <-- Store loading overlay reference
        errorMessage = errorElement;                                         // <-- Store error message reference
        
        // INITIALIZE BABYLON.JS ENGINE
        initializeBabylonEngine(canvasElement);                              // <-- Initialize engine with canvas
        
        // CREATE AND CONFIGURE SCENE
        createScene();                                                       // <-- Create complete 3D scene
        
        // LOAD 3D MODEL
        loadThreeDModel();                                                   // <-- Load and process 3D model
        
        console.log("Rendering pipeline initialized successfully");          // <-- Log initialization success
        return { engine: engine, scene: scene, sunLight: sunLight };        // <-- Return core references
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
        dispose: dispose                                                     // <-- Cleanup function
    };

// endregion -------------------------------------------------------------------

})(); 