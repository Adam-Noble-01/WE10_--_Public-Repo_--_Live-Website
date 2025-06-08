// =============================================================================
//  TRUEVISION  |  HDRI ENVIROMENT LIGHTING SYSTEM
// =============================================================================
//
// FILE       :  SceneConfig_HdriLightingLogic.js
// NAMESPACE  :  TrueVision3D.SceneConfig
// MODULE     :  HdriLightingLogic
// AUTHOR     :  Adam Noble - Noble Architecture
// PURPOSE    :  Manage HDRI-based environmental lighting for architectural visualization
// CREATED    :  07-Jun-2025
//
// DESCRIPTION:
// - Loads and applies HDRI environment textures for scene lighting
// - Manages brightness and rotation of HDRI environmental lighting
// - Integrates with main app configuration for dynamic HDRI switching
// - Provides fallback to standard lighting if HDRI loading fails
// - Handles both relative path and URL loading of HDRI assets
// - Supports real-time updates to lighting configuration
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jun-2025 - Version 1.1.1
// - Initial HDRI Lighting System Implementation
// - Configuration-driven HDRI loading and management
// - Brightness factor and rotation angle support
// - Integration with main rendering pipeline
//
// =============================================================================

// Ensure TrueVision3D namespace exists
window.TrueVision3D = window.TrueVision3D || {};
window.TrueVision3D.SceneConfig = window.TrueVision3D.SceneConfig || {};

(function() {
'use strict';

// -----------------------------------------------------------------------------
// REGION | HDRI Lighting Configuration Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Default HDRI Configuration Values
    // ------------------------------------------------------------
    const DEFAULT_BRIGHTNESS_FACTOR      = 1.0;                             // <-- Default HDRI brightness multiplier
    const DEFAULT_ROTATION_ANGLE         = 0;                               // <-- Default HDRI rotation in degrees
    const HDRI_LOAD_TIMEOUT              = 90000;                           // <-- HDRI load timeout in milliseconds
    const ROTATION_TO_RADIANS            = Math.PI / 180;                   // <-- Degree to radian conversion factor
    // ---------------------------------------------------------------

    // MODULE VARIABLES | HDRI System State Management
    // ------------------------------------------------------------
    let hdriEnabled                      = false;                           // <-- HDRI lighting enabled state
    let hdriTexture                      = null;                            // <-- Current HDRI texture reference
    let currentBrightnessFactor          = DEFAULT_BRIGHTNESS_FACTOR;       // <-- Current brightness factor
    let currentRotationAngle             = DEFAULT_ROTATION_ANGLE;          // <-- Current rotation angle in degrees
    let originalLightingState            = null;                            // <-- Store original lighting configuration
    let scene                            = null;                            // <-- Babylon.js scene reference
    let configData                       = null;                            // <-- Stored configuration data
    let sceneEnvironment                 = null;                            // <-- Scene environment reference
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | HDRI Texture Loading and Management
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert Degrees to Radians
    // ---------------------------------------------------------------
    function degreesToRadians(degrees) {
        return degrees * ROTATION_TO_RADIANS;                               // <-- Convert degrees to radians
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Validate HDRI Configuration Data
    // ---------------------------------------------------------------
    function validateHdriConfig(config) {
        if (!config || !config.SceneConfig || !config.SceneConfig.LightingConfig) {
            console.warn("Invalid HDRI configuration structure");           // <-- Log warning
            return false;                                                   // <-- Configuration invalid
        }
        
        const lightingCfg = config.SceneConfig.LightingConfig;             // <-- Get lighting config
        return lightingCfg.LightingCfg_HdriLighting === true;              // <-- Return enabled state
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Store Original Scene Lighting State
    // ---------------------------------------------------------------
    function storeOriginalLightingState() {
        if (!scene) return;                                                 // <-- Exit if no scene
        
        originalLightingState = {
            lights: [],                                                     // <-- Array to store light states
            environmentTexture: scene.environmentTexture,                   // <-- Store original environment
            ambientColor: scene.ambientColor.clone()                       // <-- Store ambient color
        };
        
        // STORE EACH LIGHT'S ORIGINAL INTENSITY
        scene.lights.forEach(light => {
            originalLightingState.lights.push({
                light: light,                                               // <-- Light reference
                intensity: light.intensity,                                 // <-- Original intensity
                enabled: light.isEnabled()                                  // <-- Original enabled state
            });
        });
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Apply HDRI Texture to Scene - CORRECTED
    // ---------------------------------------------------------------
    function applyHdriTexture(texture) {
        if (!scene || !texture) return;                                     // <-- Exit if invalid
        
        // STORE ORIGINAL ENVIRONMENT BEFORE REPLACING
        if (originalLightingState && !originalLightingState.originalEnvironmentTexture) {
            originalLightingState.originalEnvironmentTexture = scene.environmentTexture;
        }
        
        // SET HDRI AS ENVIRONMENT TEXTURE
        scene.environmentTexture = texture;                                 // <-- Apply HDRI texture
        
        // SET HDRI ROTATION AND BRIGHTNESS
        if (scene.environmentTexture) {
            const rotationRadians = degreesToRadians(currentRotationAngle); // <-- Convert to radians
            scene.environmentTexture.rotationY = rotationRadians;           // <-- Apply rotation
            scene.environmentTexture.level = currentBrightnessFactor;       // <-- Set reflection level
            
            // ENSURE PROPER COORDINATE MODE FOR SKYBOX USAGE
            scene.environmentTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
        }
        
        // CONFIGURE SCENE FOR HDRI LIGHTING
        if (scene.hasOwnProperty('environmentIntensity')) {
            scene.environmentIntensity = currentBrightnessFactor;           // <-- Apply brightness factor
        }
        
        // REPLACE SKYBOX BUT STORE REFERENCE
        if (sceneEnvironment && sceneEnvironment.skybox) {
            sceneEnvironment.skybox.setEnabled(false);                      // <-- Disable default skybox
        }
        
        // REDUCE TRADITIONAL LIGHTS MORE GRADUALLY
        scene.lights.forEach(light => {
            if (light.name !== "hemiLight") {                               // <-- Keep ambient light
                light.intensity *= 0.6;                                     // <-- Reduce lights by 40% instead of 70%
            }
        });
        
        // CRITICAL FIX: Call MaterialLogic directly, not through RenderingPipeline
        if (window.TrueVision3D?.MaterialLogic?.updateMaterialsForHdri) {
            window.TrueVision3D.MaterialLogic.updateMaterialsForHdri();     // <-- CORRECTED: Direct call to MaterialLogic
        }
        
        hdriTexture = texture;                                              // <-- Store texture reference
        hdriEnabled = true;                                                 // <-- Set enabled state
        
        console.log("HDRI texture applied successfully with material updates"); // <-- Log success with materials
    }
    // ---------------------------------------------------------------

    // FUNCTION | Load HDRI Texture from Path or URL
    // ------------------------------------------------------------
    function loadHdriTexture(path, isUrl = false) {
        return new Promise((resolve, reject) => {
            if (!scene) {
                reject("Scene not initialized");                            // <-- Reject if no scene
                return;
            }
            
            const loadPath = isUrl ? path : path;                          // <-- Use appropriate path
            
            try {
                console.log("Creating HDRCubeTexture from: " + loadPath);  // <-- Log path
                
                // VERIFY HDRCUBETEXTURE IS AVAILABLE
                if (!BABYLON.HDRCubeTexture) {
                    reject("HDRCubeTexture not available in this Babylon.js version");
                    return;
                }
                
                // CREATE HDR CUBE TEXTURE WITH STANDARD PARAMETERS
                const hdrTexture = new BABYLON.HDRCubeTexture(loadPath, scene, 512); // <-- Create HDR cube texture
                
                // SET COORDINATE MODE
                hdrTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;  // <-- Set skybox mode
                
                // TRACK LOADING STATE
                let isResolved = false;                                    // <-- Prevent multiple resolutions
                let timeoutId = null;                                      // <-- Timeout reference
                
                // CHECK IF TEXTURE IS READY USING POLLING
                const checkReady = () => {
                    if (isResolved) return;                                 // <-- Exit if already resolved
                    
                    if (hdrTexture.isReady()) {
                        isResolved = true;                                  // <-- Mark as resolved
                        if (timeoutId) clearTimeout(timeoutId);            // <-- Clear timeout
                        console.log("HDRI texture loaded: " + loadPath);   // <-- Log success
                        resolve(hdrTexture);                                // <-- Resolve with texture
                    } else {
                        // CHECK AGAIN IN 100MS
                        setTimeout(checkReady, 100);                        // <-- Poll until ready
                    }
                };
                
                // START CHECKING AFTER BRIEF DELAY
                setTimeout(checkReady, 100);                                // <-- Initial delay
                
                // TIMEOUT AFTER 30 SECONDS
                timeoutId = setTimeout(() => {
                    if (!isResolved) {
                        isResolved = true;                                  // <-- Prevent further checks
                        reject("HDRI load timeout exceeded for: " + loadPath); // <-- Timeout error
                    }
                }, HDRI_LOAD_TIMEOUT);
                
            } catch (error) {
                reject("Failed to create HDRI texture: " + error);         // <-- Reject with error
            }
        });
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | HDRI Lighting Control Functions
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize HDRI Lighting System
    // ------------------------------------------------------------
    function initialize(babylonScene, appConfig, environment) {
        scene = babylonScene;                                               // <-- Store scene reference
        configData = appConfig;                                             // <-- Store config reference
        sceneEnvironment = environment;                                     // <-- Store environment reference
        
        // VALIDATE CONFIGURATION
        if (!validateHdriConfig(appConfig)) {
            console.log("HDRI lighting disabled in configuration");         // <-- Log disabled state
            return false;                                                   // <-- Exit if disabled
        }
        
        const lightingCfg = appConfig.SceneConfig.LightingConfig;          // <-- Get lighting config
        
        // EXTRACT CONFIGURATION VALUES
        hdriEnabled = lightingCfg.LightingCfg_HdriLighting === true;       // <-- Get enabled state
        currentBrightnessFactor = lightingCfg.LightingCfg_HdrirBrightnessFactor || DEFAULT_BRIGHTNESS_FACTOR;
        currentRotationAngle = lightingCfg.LightingCfg_HdrirRotationAngleDeg || DEFAULT_ROTATION_ANGLE;
        
        // STORE ORIGINAL LIGHTING STATE
        storeOriginalLightingState();                                      // <-- Save current lighting
        
        // LOAD HDRI IF ENABLED
        if (hdriEnabled) {
            const hdriPath = lightingCfg.LightingCfg_HdriLightingRelativePath;
            const hdriUrl = lightingCfg.LightingCfg_HdriLightingURL;
            
            // TRY URL FIRST SINCE IT'S VALIDATED TO WORK
            loadHdriTexture(hdriUrl, true)
                .then(texture => {
                    applyHdriTexture(texture);                              // <-- Apply loaded texture with material updates
                })
                .catch(error => {
                    console.error("Failed to load HDRI texture from URL: " + error);
                    // TRY RELATIVE PATH AS FALLBACK
                    return loadHdriTexture(hdriPath, false);               // <-- Try relative path
                })
                .then(texture => {
                    if (texture) applyHdriTexture(texture);                // <-- Apply from path with material updates
                })
                .catch(error => {
                    console.error("Failed to load HDRI texture: " + error); // <-- Log final error
                    hdriEnabled = false;                                    // <-- Disable HDRI
                });
        }
        
        console.log("HDRI lighting system initialized");                    // <-- Log initialization
        return hdriEnabled;                                                 // <-- Return enabled state
    }
    // ---------------------------------------------------------------

    // FUNCTION | Update HDRI Brightness Factor - CORRECTED
    // ------------------------------------------------------------
    function setBrightnessFactor(factor) {
        currentBrightnessFactor = Math.max(0.1, Math.min(20.0, factor));   // <-- Clamp between 0.1 and 20
        
        if (scene && scene.environmentTexture && hdriEnabled) {
            scene.environmentIntensity = currentBrightnessFactor;           // <-- Update intensity
            scene.environmentTexture.level = currentBrightnessFactor;       // <-- Update reflection level
            
            // CRITICAL FIX: Call MaterialLogic directly
            if (window.TrueVision3D?.MaterialLogic?.updateMaterialsForHdri) {
                window.TrueVision3D.MaterialLogic.updateMaterialsForHdri(); // <-- CORRECTED: Direct call
            }
            
            console.log("HDRI brightness updated to: " + currentBrightnessFactor);
        }
        
        return currentBrightnessFactor;                                     // <-- Return clamped value
    }
    // ---------------------------------------------------------------

    // FUNCTION | Update HDRI Rotation Angle
    // ------------------------------------------------------------
    function setRotationAngle(angleDegrees) {
        currentRotationAngle = angleDegrees % 360;                         // <-- Wrap to 0-360 range
        
        if (scene && scene.environmentTexture && hdriEnabled) {
            const rotationRadians = degreesToRadians(currentRotationAngle);
            scene.environmentTexture.rotationY = rotationRadians;           // <-- Apply rotation
            
            console.log("HDRI rotation updated to: " + currentRotationAngle + " degrees");
        }
        
        return currentRotationAngle;                                        // <-- Return wrapped value
    }
    // ---------------------------------------------------------------

    // FUNCTION | Toggle HDRI Lighting On/Off
    // ------------------------------------------------------------
    function toggleHdriLighting() {
        hdriEnabled = !hdriEnabled;                                         // <-- Toggle state
        
        if (hdriEnabled && hdriTexture) {
            applyHdriTexture(hdriTexture);                                 // <-- Reapply HDRI with material updates
        } else if (!hdriEnabled && originalLightingState) {
            restoreOriginalLighting();                                      // <-- Restore original with material restoration
        }
        
        console.log("HDRI lighting " + (hdriEnabled ? "enabled" : "disabled") + " with material adaptation");
        return hdriEnabled;                                                 // <-- Return new state
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Restore Original Scene Lighting - CORRECTED
    // ---------------------------------------------------------------
    function restoreOriginalLighting() {
        if (!scene || !originalLightingState) return;                      // <-- Exit if invalid
        
        // CRITICAL FIX: Call MaterialLogic directly for restoration
        if (window.TrueVision3D?.MaterialLogic?.restoreMaterialsFromHdri) {
            window.TrueVision3D.MaterialLogic.restoreMaterialsFromHdri();   // <-- CORRECTED: Direct call
        }
        
        // RESTORE ENVIRONMENT TEXTURE
        scene.environmentTexture = originalLightingState.originalEnvironmentTexture || originalLightingState.environmentTexture;
        scene.ambientColor = originalLightingState.ambientColor;           // <-- Restore ambient color
        
        // RESTORE SCENE ENVIRONMENT INTENSITY
        if (scene.hasOwnProperty('environmentIntensity')) {
            scene.environmentIntensity = 1.0;                               // <-- Reset to standard intensity
        }
        
        // RESTORE LIGHT INTENSITIES
        originalLightingState.lights.forEach(lightState => {
            if (lightState.light) {
                lightState.light.intensity = lightState.intensity;         // <-- Restore original intensity
                lightState.light.setEnabled(lightState.enabled);           // <-- Restore original enabled state
            }
        });
        
        // RE-ENABLE SKYBOX IF EXISTS
        if (sceneEnvironment && sceneEnvironment.skybox) {
            sceneEnvironment.skybox.setEnabled(true);                      // <-- Re-enable default skybox
        }
        
        console.log("Original lighting and materials fully restored");      // <-- Log complete restoration
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Utility Functions and State Queries
// -----------------------------------------------------------------------------

    // FUNCTION | Get Current HDRI Configuration State
    // ------------------------------------------------------------
    function getHdriState() {
        return {
            enabled: hdriEnabled,                                          // <-- Current enabled state
            brightnessFactor: currentBrightnessFactor,                     // <-- Current brightness
            rotationAngle: currentRotationAngle,                           // <-- Current rotation
            textureLoaded: hdriTexture !== null                            // <-- Texture load status
        };
    }
    // ---------------------------------------------------------------

    // FUNCTION | Reload HDRI with New Configuration
    // ------------------------------------------------------------
    function reloadWithConfig(newConfig) {
        if (!validateHdriConfig(newConfig)) {
            console.warn("Invalid configuration for HDRI reload");          // <-- Log warning
            return false;                                                   // <-- Exit on invalid config
        }
        
        // STORE ENVIRONMENT REFERENCE BEFORE DISPOSAL
        const env = sceneEnvironment;                                       // <-- Save environment reference
        
        // DISPOSE CURRENT HDRI
        dispose();                                                          // <-- Clean up current
        
        // REINITIALIZE WITH NEW CONFIG
        return initialize(scene, newConfig, env);                           // <-- Reinitialize with environment
    }
    // ---------------------------------------------------------------

    // FUNCTION | Dispose HDRI Lighting Resources
    // ------------------------------------------------------------
    function dispose() {
        if (hdriTexture) {
            hdriTexture.dispose();                                          // <-- Dispose texture
            hdriTexture = null;                                             // <-- Clear reference
        }
        
        if (originalLightingState) {
            restoreOriginalLighting();                                      // <-- Restore original
            originalLightingState = null;                                   // <-- Clear state
        }
        
        hdriEnabled = false;                                                // <-- Reset enabled state
        scene = null;                                                       // <-- Clear scene reference
        configData = null;                                                  // <-- Clear config reference
        sceneEnvironment = null;                                            // <-- Clear environment reference
        
        console.log("HDRI lighting system disposed");                       // <-- Log disposal
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Export and Public Interface
// -----------------------------------------------------------------------------

    // EXPOSE PUBLIC API
    window.TrueVision3D.SceneConfig.HdriLightingLogic = {
        initialize: initialize,                                            // <-- Initialize function
        setBrightnessFactor: setBrightnessFactor,                          // <-- Set brightness function
        setRotationAngle: setRotationAngle,                                // <-- Set rotation function
        toggleHdriLighting: toggleHdriLighting,                            // <-- Toggle HDRI function
        getHdriState: getHdriState,                                        // <-- Get state function
        reloadWithConfig: reloadWithConfig,                                // <-- Reload config function
        dispose: dispose                                                   // <-- Cleanup function
    };

// endregion -------------------------------------------------------------------

})(); 