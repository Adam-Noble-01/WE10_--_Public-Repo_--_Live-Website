// =============================================================================
// TRUEVISION 3D - SSAO AMBIENT OCCLUSION EFFECT MODULE
// =============================================================================
//
// FILE       : RenderEffect_SsaoAmbientOcclusionEffect.js
// NAMESPACE  : TrueVision3D.RenderEffects
// MODULE     : SsaoAmbientOcclusionEffect
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Screen Space Ambient Occlusion effect for architectural visualization
// CREATED    : 07-Jun-2025
//
// DESCRIPTION:
// - Implements both modern SSAO2 (WebGL2) and legacy SSAO (WebGL1) rendering pipelines
// - Automatically detects and uses the best available method with graceful fallback
// - Provides configurable quality settings optimized for architectural interiors
// - Handles transparent materials to prevent artifacts on glass surfaces
// - Includes mobile/iOS specific optimizations and memory management
// - Supports dynamic quality scaling based on device capabilities
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jun-2025 - Version 1.0.0
// - Initial implementation with SSAO2/SSAO dual support
// - Automatic WebGL2 detection and fallback logic
// - Configurable quality presets for different devices
// - Transparent material exclusion for architectural glass
//
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Module Definition and Namespace
// -----------------------------------------------------------------------------

    // MODULE NAMESPACE | Define TrueVision3D Render Effects Namespace
    // ------------------------------------------------------------
    window.TrueVision3D = window.TrueVision3D || {};                             // <-- Create namespace if not exists
    window.TrueVision3D.RenderEffects = window.TrueVision3D.RenderEffects || {}; // <-- Create effects namespace
    
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | PC-SPECIFIC SSAO CONFIGURATION
// -----------------------------------------------------------------------------

    // PC QUALITY PRESETS | High-End Desktop Settings
    // ------------------------------------------------------------
    const PC_QUALITY_PRESETS = {
        ULTRA: {
            ssaoRatio              : 1.0,                                    // <-- Full resolution SSAO
            blurRatio              : 1.0,                                    // <-- Full resolution blur
            combineRatio           : 1.0,                                    // <-- Full resolution output
            samples                : 32,                                     // <-- Maximum sample count
            radius                 : 0.5,                                    // <-- Large sampling radius
            totalStrength          : 1.5,                                    // <-- Strong effect
            base                   : 0.0,                                    // <-- Full occlusion possible
            expensiveBlur          : true,                                   // <-- High quality blur
            maxZ                   : 100.0,                                  // <-- Extended far plane
            minZAspect             : 0.2                                     // <-- Standard depth scaling
        },
        HIGH: {
            ssaoRatio              : 1.0,                                    // <-- Full resolution SSAO
            blurRatio              : 1.0,                                    // <-- Full resolution blur
            combineRatio           : 1.0,                                    // <-- Full resolution output
            samples                : 16,                                     // <-- High sample count
            radius                 : 0.4,                                    // <-- Standard radius
            totalStrength          : 1.2,                                    // <-- Strong effect
            base                   : 0.1,                                    // <-- Nearly full occlusion
            expensiveBlur          : true,                                   // <-- High quality blur
            maxZ                   : 100.0,                                  // <-- Standard far plane
            minZAspect             : 0.2                                     // <-- Standard depth scaling
        }
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | MOBILE-SPECIFIC SSAO CONFIGURATION
// -----------------------------------------------------------------------------

    // MOBILE QUALITY PRESETS | Battery-Optimized Settings
    // ------------------------------------------------------------
    const MOBILE_QUALITY_PRESETS = {
        MOBILE_HIGH: {
            ssaoRatio              : 0.75,                                   // <-- Reduced resolution
            blurRatio              : 0.75,                                   // <-- Matching blur resolution
            combineRatio           : 1.0,                                    // <-- Full resolution output
            samples                : 8,                                      // <-- Limited samples
            radius                 : 0.25,                                   // <-- Smaller radius
            totalStrength          : 0.8,                                    // <-- Moderate effect
            base                   : 0.2,                                    // <-- Lighter shadows
            expensiveBlur          : false,                                  // <-- Fast blur only
            maxZ                   : 75.0,                                   // <-- Reduced far plane
            minZAspect             : 0.2                                     // <-- Standard depth scaling
        },
        MOBILE_LOW: {
            ssaoRatio              : 0.5,                                    // <-- Half resolution
            blurRatio              : 0.5,                                    // <-- Half resolution blur
            combineRatio           : 1.0,                                    // <-- Full resolution output
            samples                : 4,                                      // <-- Minimal samples
            radius                 : 0.15,                                   // <-- Very tight radius
            totalStrength          : 0.6,                                    // <-- Subtle effect
            base                   : 0.3,                                    // <-- Light shadows only
            expensiveBlur          : false,                                  // <-- Fast blur required
            maxZ                   : 50.0,                                   // <-- Limited far plane
            minZAspect             : 0.2                                     // <-- Standard depth scaling
        }
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | SSAO Ambient Occlusion Effect Module Implementation
// -----------------------------------------------------------------------------

TrueVision3D.RenderEffects.SsaoAmbientOcclusionEffect = (function() {

    // MODULE CONSTANTS | SSAO Configuration Presets
    // ------------------------------------------------------------
    const QUALITY_PRESETS = {
        HIGH: {
            ssaoRatio              : 1.0,                                    // <-- Full resolution SSAO computation
            blurRatio              : 1.0,                                    // <-- Full resolution blur pass
            combineRatio           : 1.0,                                    // <-- Full resolution combine pass
            samples                : 32,                                     // <-- High sample count for smooth AO
            radius                 : 0.3,                                    // <-- Moderate radius for architectural scale
            totalStrength          : 1.5,                                    // <-- Strong but not overwhelming effect
            base                   : 0.1,                                    // <-- Slight base to prevent pure black
            expensiveBlur          : true,                                   // <-- High quality bilateral blur
            maxZ                   : 100.0,                                  // <-- Far clipping for interior scenes
            minZAspect             : 0.2                                     // <-- Standard depth scaling
        },
        MEDIUM: {
            ssaoRatio              : 0.75,                                   // <-- 75% resolution for balance
            blurRatio              : 0.75,                                   // <-- Matching blur resolution
            combineRatio           : 1.0,                                    // <-- Full resolution output
            samples                : 16,                                     // <-- Moderate sample count
            radius                 : 0.25,                                   // <-- Slightly tighter radius
            totalStrength          : 1.2,                                    // <-- Standard intensity
            base                   : 0.15,                                   // <-- More base for softer shadows
            expensiveBlur          : true,                                   // <-- Keep quality blur
            maxZ                   : 100.0,                                  // <-- Standard far plane
            minZAspect             : 0.2                                     // <-- Standard depth scaling
        },
        LOW: {
            ssaoRatio              : 0.5,                                    // <-- Half resolution for performance
            blurRatio              : 0.5,                                    // <-- Half resolution blur
            combineRatio           : 1.0,                                    // <-- Full resolution output
            samples                : 8,                                      // <-- Minimal samples for speed
            radius                 : 0.2,                                    // <-- Tight radius for performance
            totalStrength          : 0.8,                                    // <-- Reduced intensity
            base                   : 0.2,                                    // <-- Higher base for lighter effect
            expensiveBlur          : false,                                  // <-- Fast blur for mobile
            maxZ                   : 100.0,                                  // <-- Standard far plane
            minZAspect             : 0.2                                     // <-- Standard depth scaling
        },
        MOBILE: {
            ssaoRatio              : 0.5,                                    // <-- Half resolution essential for mobile
            blurRatio              : 0.5,                                    // <-- Matching blur resolution
            combineRatio           : 1.0,                                    // <-- Full resolution output
            samples                : 4,                                      // <-- Minimal samples for battery life
            radius                 : 0.15,                                   // <-- Very tight radius
            totalStrength          : 0.6,                                    // <-- Subtle effect only
            base                   : 0.3,                                    // <-- High base for light shadows
            expensiveBlur          : false,                                  // <-- Fast blur required
            maxZ                   : 50.0,                                   // <-- Reduced far plane for performance
            minZAspect             : 0.2                                     // <-- Standard depth scaling
        }
    };
    // ------------------------------------------------------------

    // MODULE VARIABLES | Pipeline and Configuration State
    // ------------------------------------------------------------
    let ssaoPipeline           = null;                                       // <-- Active SSAO pipeline instance
    let ssaoIsEnabled          = false;                                      // <-- Current enabled state
    let currentQuality         = "MEDIUM";                                   // <-- Current quality preset
    let scene                  = null;                                       // <-- Babylon scene reference
    let camera                 = null;                                       // <-- Active camera reference
    let isLegacyMode           = false;                                      // <-- Track if using legacy pipeline
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Device Detection and Quality Selection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Detect Device Type and Capabilities
    // ---------------------------------------------------------------
    function detectDeviceCapabilities() {
        const userAgent = navigator.userAgent.toLowerCase();                 // <-- Get lowercase user agent
        const isIOS = /iphone|ipad|ipod/.test(userAgent);                  // <-- Check for iOS devices
        const isAndroid = /android/.test(userAgent);                       // <-- Check for Android devices
        const isMobile = isIOS || isAndroid;                               // <-- Any mobile device
        
        // CHECK WEBGL2 SUPPORT
        const canvas = document.createElement('canvas');                     // <-- Temporary canvas for test
        const gl = canvas.getContext('webgl2');                            // <-- Try WebGL2 context
        const hasWebGL2 = !!gl;                                            // <-- Convert to boolean
        
        return {
            isMobile: isMobile,                                             // <-- Mobile device flag
            isIOS: isIOS,                                                   // <-- iOS specific flag
            hasWebGL2: hasWebGL2,                                           // <-- WebGL2 support flag
            devicePixelRatio: window.devicePixelRatio || 1                 // <-- Screen pixel density
        };
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Select Appropriate Quality Preset
    // ---------------------------------------------------------------
    function selectQualityPreset(customQuality) {
        if (customQuality && QUALITY_PRESETS[customQuality]) {              // <-- Use custom if valid
            return customQuality;                                           // <-- Return custom quality
        }
        
        const capabilities = detectDeviceCapabilities();                    // <-- Get device capabilities
        
        if (capabilities.isMobile) {                                        // <-- Mobile device detected
            return "MOBILE";                                                // <-- Use mobile preset
        } else if (!capabilities.hasWebGL2) {                              // <-- Legacy WebGL1 only
            return "LOW";                                                   // <-- Use low preset
        } else if (capabilities.devicePixelRatio > 2) {                    // <-- High DPI display
            return "MEDIUM";                                                // <-- Balance quality/performance
        } else {                                                            // <-- Desktop with WebGL2
            return "HIGH";                                                  // <-- Maximum quality
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | SSAO Pipeline Creation and Configuration
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize SSAO Effect with Automatic Method Selection
    // ------------------------------------------------------------
    function initialize(babylonScene, activeCamera, quality) {
        scene = babylonScene;                                               // <-- Store scene reference
        camera = activeCamera;                                              // <-- Store camera reference
        currentQuality = selectQualityPreset(quality);                      // <-- Determine quality preset
        
        if (!scene || !camera) {                                            // <-- Validate required objects
            console.error("SSAO Effect: Scene and camera required");        // <-- Log error
            return false;                                                   // <-- Return failure
        }
        
        const preset = QUALITY_PRESETS[currentQuality];                     // <-- Get quality settings
        
        try {
            // ATTEMPT MODERN SSAO2 PIPELINE FIRST
            if (BABYLON.SSAO2RenderingPipeline.IsSupported) {              // <-- Check WebGL2 support
                createSSAO2Pipeline(preset);                                // <-- Create modern pipeline
                isLegacyMode = false;                                       // <-- Mark as modern mode
                console.log("SSAO Effect: Using modern SSAO2 pipeline");    // <-- Log success
            } else {
                // FALLBACK TO LEGACY SSAO PIPELINE
                createLegacySSAOPipeline(preset);                           // <-- Create legacy pipeline
                isLegacyMode = true;                                        // <-- Mark as legacy mode
                console.log("SSAO Effect: Using legacy SSAO pipeline");     // <-- Log fallback
            }
            
            // TEMPORARY DEBUG: Comment out this line
            // if (window.TrueVision3D.MaterialLogic) {
            //     window.TrueVision3D.MaterialLogic.configureTransparentMaterials(); // <-- Handle glass materials
            // }
            
            ssaoIsEnabled = true;                                            // <-- Mark as enabled
            return true;                                                    // <-- Return success
            
        } catch (error) {
            console.error("SSAO Effect: Failed to initialize", error);      // <-- Log error details
            return false;                                                   // <-- Return failure
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Create Modern SSAO2 Pipeline
    // ---------------------------------------------------------------
    function createSSAO2Pipeline(preset) {
        // CONFIGURE RESOLUTION RATIOS
        const ssaoRatio = {
            ssaoRatio: preset.ssaoRatio,                                    // <-- SSAO computation resolution
            blurRatio: preset.blurRatio,                                    // <-- Blur pass resolution
            combineRatio: preset.combineRatio                               // <-- Final combine resolution
        };
        
        // CREATE SSAO2 PIPELINE (NO CAMERA IN CONSTRUCTOR)
        ssaoPipeline = new BABYLON.SSAO2RenderingPipeline(
            "ssao2",                                                        // <-- Pipeline name
            scene,                                                          // <-- Scene reference
            ssaoRatio                                                       // <-- Resolution configuration
            // NOTE: No camera array parameter for SSAO2 according to research doc
        );
        
        // ATTACH TO CAMERA AFTER CREATION
        scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(
            "ssao2",                                                        // <-- Pipeline name
            camera                                                          // <-- Camera to attach
        );
        
        // CONFIGURE SSAO2 PARAMETERS
        ssaoPipeline.radius = preset.radius;                                // <-- Sample radius
        ssaoPipeline.totalStrength = preset.totalStrength;                  // <-- Effect intensity
        ssaoPipeline.base = preset.base;                                    // <-- Base ambient light
        ssaoPipeline.samples = preset.samples;                              // <-- Sample count
        ssaoPipeline.maxZ = preset.maxZ;                                    // <-- Far clipping distance
        ssaoPipeline.minZAspect = preset.minZAspect;                        // <-- Depth scaling factor
        ssaoPipeline.expensiveBlur = preset.expensiveBlur;                  // <-- Blur quality setting
        
        // EPSILON FOR LOW SAMPLE ARTIFACT REDUCTION
        if (preset.samples < 16) {                                          // <-- Low sample count detected
            ssaoPipeline.epsilon = 0.02;                                    // <-- Apply epsilon correction
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Create Legacy SSAO Pipeline for WebGL1
    // ---------------------------------------------------------------
    function createLegacySSAOPipeline(preset) {
        // CONFIGURE RESOLUTION RATIOS
        const ssaoRatio = {
            ssaoRatio: preset.ssaoRatio,                                    // <-- SSAO computation resolution
            combineRatio: preset.combineRatio                               // <-- Final combine resolution
        };
        
        // CREATE LEGACY SSAO PIPELINE
        ssaoPipeline = new BABYLON.SSAORenderingPipeline(
            "ssaoLegacy",                                                   // <-- Pipeline name
            scene,                                                          // <-- Scene reference
            ssaoRatio,                                                      // <-- Resolution configuration
            [camera]                                                        // <-- Camera array
        );
        
        // CONFIGURE LEGACY SSAO PARAMETERS
        ssaoPipeline.radius = preset.radius;                                // <-- Sample radius
        ssaoPipeline.totalStrength = preset.totalStrength;                  // <-- Effect intensity
        ssaoPipeline.base = preset.base;                                    // <-- Base ambient light
        ssaoPipeline.samples = Math.min(preset.samples, 16);                // <-- Cap samples for legacy
        ssaoPipeline.fallOff = 0.000001;                                    // <-- Falloff factor
        ssaoPipeline.area = 0.0075;                                         // <-- Area factor
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Configure Transparent Material Handling
    // ---------------------------------------------------------------
    function configureTransparentMaterials() {
        // TEMPORARY DEBUG: Comment out this line
        // if (window.TrueVision3D.MaterialLogic) {
        //     window.TrueVision3D.MaterialLogic.configureTransparentMaterials();
        // }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Runtime Control and Quality Management
// -----------------------------------------------------------------------------

    // FUNCTION | Enable or Disable SSAO Effect
    // ------------------------------------------------------------
    function setEnabled(enabled) {
        if (!ssaoPipeline) return;                                          // <-- Exit if not initialized
        
        ssaoIsEnabled = enabled;                                             // <-- Update enabled state
        
        if (enabled) {                                                      // <-- Enable effect
            scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(
                ssaoPipeline.name,                                          // <-- Pipeline name
                camera                                                      // <-- Camera to attach
            );
        } else {                                                            // <-- Disable effect
            scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(
                ssaoPipeline.name,                                          // <-- Pipeline name
                camera                                                      // <-- Camera to detach
            );
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Update Quality Settings at Runtime
    // ------------------------------------------------------------
    function updateQuality(quality) {
        if (!scene || !camera) return;                                      // <-- Exit if not initialized
        
        currentQuality = selectQualityPreset(quality);                      // <-- Update quality preset
        const preset = QUALITY_PRESETS[currentQuality];                     // <-- Get new settings
        
        if (ssaoPipeline) {                                                 // <-- If pipeline exists
            // UPDATE COMMON PARAMETERS
            ssaoPipeline.radius = preset.radius;                            // <-- Update sample radius
            ssaoPipeline.totalStrength = preset.totalStrength;              // <-- Update intensity
            ssaoPipeline.base = preset.base;                                // <-- Update base light
            ssaoPipeline.samples = preset.samples;                           // <-- Update sample count
            
            // UPDATE SSAO2 SPECIFIC PARAMETERS
            if (!isLegacyMode) {                                            // <-- If modern pipeline
                ssaoPipeline.maxZ = preset.maxZ;                            // <-- Update far plane
                ssaoPipeline.minZAspect = preset.minZAspect;                // <-- Update depth scaling
                ssaoPipeline.expensiveBlur = preset.expensiveBlur;          // <-- Update blur quality
                
                if (preset.samples < 16) {                                  // <-- Low sample count
                    ssaoPipeline.epsilon = 0.02;                            // <-- Apply epsilon
                }
            }
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Current SSAO Settings
    // ------------------------------------------------------------
    function getCurrentSettings() {
        if (!ssaoPipeline) return null;                                     // <-- Return null if not initialized
        
        return {
            enabled: ssaoIsEnabled,                                          // <-- Current enabled state
            quality: currentQuality,                                        // <-- Current quality preset
            isLegacy: isLegacyMode,                                        // <-- Pipeline type
            radius: ssaoPipeline.radius,                                    // <-- Current radius
            strength: ssaoPipeline.totalStrength,                           // <-- Current strength
            samples: ssaoPipeline.samples                                   // <-- Current sample count
        };
    }
    // ---------------------------------------------------------------

    // FUNCTION | Check if SSAO Effect is Enabled
    // ------------------------------------------------------------
    function isEnabled() {
        return ssaoIsEnabled;                                                // <-- Return current enabled state
    }
    // ---------------------------------------------------------------

    // FUNCTION | Update Camera for SSAO Effect
    // ------------------------------------------------------------
    function updateCamera(newCamera) {
        if (!ssaoPipeline || !scene || !newCamera) return;                 // <-- Validate inputs
        
        // DETACH FROM OLD CAMERA IF EXISTS
        if (camera && ssaoIsEnabled) {
            scene.postProcessRenderPipelineManager.detachCamerasFromRenderPipeline(
                ssaoPipeline.name,                                          // <-- Pipeline name
                camera                                                      // <-- Old camera
            );
        }
        
        // UPDATE CAMERA REFERENCE
        camera = newCamera;                                                 // <-- Store new camera
        
        // REATTACH TO NEW CAMERA IF ENABLED
        if (ssaoIsEnabled) {
            scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(
                ssaoPipeline.name,                                          // <-- Pipeline name
                camera                                                      // <-- New camera
            );
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Cleanup and Resource Management
// -----------------------------------------------------------------------------

    // FUNCTION | Dispose SSAO Pipeline and Free Resources
    // ------------------------------------------------------------
    function dispose() {
        if (ssaoPipeline) {                                                 // <-- Check pipeline exists
            ssaoPipeline.dispose();                                         // <-- Dispose pipeline resources
            ssaoPipeline = null;                                            // <-- Clear reference
        }
        
        scene = null;                                                       // <-- Clear scene reference
        camera = null;                                                      // <-- Clear camera reference
        ssaoIsEnabled = false;                                               // <-- Reset enabled state
        isLegacyMode = false;                                              // <-- Reset legacy flag
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Public API Interface
// -----------------------------------------------------------------------------

    // MODULE PUBLIC API | Exposed Methods
    // ------------------------------------------------------------
    return {
        initialize: initialize,                                             // <-- Initialize SSAO effect
        setEnabled: setEnabled,                                             // <-- Enable/disable effect
        isEnabled: isEnabled,                                               // <-- Check enabled state
        updateQuality: updateQuality,                                       // <-- Change quality preset
        getCurrentSettings: getCurrentSettings,                             // <-- Get current configuration
        updateCamera: updateCamera,                                         // <-- Update camera reference
        dispose: dispose,                                                   // <-- Cleanup resources
        QUALITY_PRESETS: Object.keys(QUALITY_PRESETS)                       // <-- Available quality options
    };
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

})();

// MARK MODULE AS LOADED
if (window.TrueVision3D.ModuleDependencyManager) {
    window.TrueVision3D.ModuleDependencyManager.markModuleLoaded('RenderEffects');
}

// endregion -------------------------------------------------------------------
