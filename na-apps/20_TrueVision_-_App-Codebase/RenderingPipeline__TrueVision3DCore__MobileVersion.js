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
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 2025 - Version 1.0.0
// - Split from unified pipeline for device-specific optimization
// - Mobile-specific optimizations and iOS compatibility fixes
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
    const TEXTURE_OPTIMIZATION         = true;                               // <-- Enable texture optimization
    const MAX_TEXTURE_SIZE             = 2048;                               // <-- Limit texture sizes
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Mobile Detection
    // ------------------------------------------------------------
    let isMobileDevice                 = false;                              // <-- Mobile device flag
    let isIOSDevice                    = false;                              // <-- iOS device flag
    // ---------------------------------------------------------------

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
    // ---------------------------------------------------------------

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
            failIfMajorPerformanceCaveat: false,                           // <-- Don't fail on performance issues
            doNotHandleContextLost: false,                                   // <-- Handle context lost
            audioEngine: true                                                // <-- Enable audio engine
        };
        
        engine = new BABYLON.Engine(canvas, true, engineOptions);           // <-- Create engine with PC options
        
        // PC-SPECIFIC ENGINE SETTINGS
        engine.enableOfflineSupport = false;                                 // <-- Disable offline support
        engine.doNotHandleContextLost = false;                              // <-- Handle WebGL context loss
        
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
        
        console.log(`Mobile device detected: ${isMobileDevice}, iOS: ${isIOSDevice}`);
        
        // MOBILE-SPECIFIC ENGINE OPTIONS
        const engineOptions = {
            preserveDrawingBuffer: true,
            stencil: true,
            powerPreference: "default",                                      // <-- CRITICAL: Battery-safe mode for mobile
            antialias: false,                                                // <-- Disable antialiasing for performance
            alpha: false,                                                    // <-- No alpha for better performance
            depth: true,                                                     // <-- Enable depth buffer
            failIfMajorPerformanceCaveat: true,                            // <-- Fail if major performance issues
            doNotHandleContextLost: false,                                   // <-- Handle context lost
            audioEngine: false,                                              // <-- Disable audio to save resources
            deterministicLockstep: true,                                     // <-- Ensure consistent frame timing
            timeStep: 1/30                                                   // <-- Target 30 FPS on mobile
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

})();