// =============================================================================
// VALEDESIGNSUITE - FLY NAVIGATION SYSTEM LOGIC
// =============================================================================
//
// FILE       : NavMode_FlyNavigationSystemLogic.js
// NAMESPACE  : TrueVision3D.NavigationModes
// MODULE     : FlyNavigation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Free-fly camera navigation for architectural visualization
// CREATED    : 2025
//
// DESCRIPTION:
// - Implements a fly-through navigation system using Babylon.js FreeCamera
// - Provides free movement in 3D space with keyboard and mouse controls
// - Supports WASD movement keys and mouse look functionality
// - Includes configurable movement speed and sensitivity settings
// - Advanced navigation mode for exploring architectural models freely
//
// INTEGRATION WITH UI MENU SYSTEM:
// - This module provides the camera and navigation logic for fly mode
// - The UiMenu_NavModeButtonManager.js handles the toolbar button for this mode
// - When enabled via the UI button, this module takes control of the camera
// - The UI manager coordinates switching between this and other navigation modes
// - This module does NOT create its own UI controls (uses keyboard/mouse only)
// - Button visibility and mode switching is managed externally by ApplicationCore
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jan-2025 - Version 1.0.0
// - Initial implementation extracted from main index.html
// - Added proper module structure and namespace
// - Implemented enable/disable functionality
// - Added camera reset capabilities
//
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Module Namespace and Initialization
// -----------------------------------------------------------------------------

    // Create namespace structure if it doesn't exist
    window.TrueVision3D = window.TrueVision3D || {};
    window.TrueVision3D.NavigationModes = window.TrueVision3D.NavigationModes || {};

// endregion -------------------------------------------------------------------

(function() {
    'use strict';

// -----------------------------------------------------------------------------
// REGION | Module Constants and Configuration
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Camera Configuration Defaults
    // ------------------------------------------------------------
    const DEFAULT_POSITION             = new BABYLON.Vector3(10, 25, 90);    // <-- Initial camera position
    const DEFAULT_TARGET               = BABYLON.Vector3.Zero();             // <-- Initial look target
    const MOVEMENT_SPEED               = 0.7;                                // <-- Movement speed multiplier
    const MOVEMENT_INERTIA             = 0.1;                                // <-- Movement inertia factor
    const ANGULAR_SENSIBILITY          = 5000;                               // <-- Mouse look sensitivity
    const CAMERA_OFFSET                = 10;                                 // <-- Additional positioning offset
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Variables and State Management
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Core Navigation State
    // ------------------------------------------------------------
    let scene                          = null;                              // <-- Babylon.js scene reference
    let canvas                         = null;                              // <-- HTML canvas element
    let flyCamera                      = null;                              // <-- FreeCamera instance
    let isEnabled                      = false;                             // <-- Navigation mode enabled state
    let defaultPosition                = null;                              // <-- Default camera position
    let defaultTarget                  = null;                              // <-- Default camera target
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Camera Creation and Management
// -----------------------------------------------------------------------------

    // FUNCTION | Create and Configure Fly Camera
    // ------------------------------------------------------------
    function createFlyCamera() {
        if (!scene) return null;                                            // <-- Validate scene exists
        
        // CREATE FREE CAMERA FOR FLY-THROUGH MODE
        flyCamera = new BABYLON.FreeCamera("flyCamera", 
            DEFAULT_POSITION.clone(), scene);                               // <-- Create at default position
            
        // CONFIGURE CAMERA MOVEMENT PROPERTIES
        flyCamera.speed = MOVEMENT_SPEED;                                    // <-- Set movement speed
        flyCamera.inertia = MOVEMENT_INERTIA;                                // <-- Set movement inertia
        flyCamera.angularSensibility = ANGULAR_SENSIBILITY;                  // <-- Set mouse sensitivity
        
        // CONFIGURE CAMERA CLIPPING PLANES
        flyCamera.minZ = 0.1;                                                // <-- Near clipping plane
        flyCamera.maxZ = 10000;                                              // <-- Far clipping plane
        
        // CONFIGURE CAMERA COLLISION DETECTION
        flyCamera.checkCollisions = false;                                   // <-- Disable collisions for free movement
        
        // STORE DEFAULT POSITION AND TARGET
        defaultPosition = new BABYLON.Vector3(5, 2, 18 - CAMERA_OFFSET);     // <-- Alternative default position
        defaultTarget = DEFAULT_TARGET.clone();                              // <-- Default target position
        
        return flyCamera;                                                    // <-- Return configured camera
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Reset Camera to Default View
    // ---------------------------------------------------------------
    function resetCameraView() {
        if (!flyCamera) return;                                              // <-- Validate camera exists
        
        flyCamera.position = defaultPosition.clone();                        // <-- Reset to default position
        flyCamera.setTarget(defaultTarget.clone());                          // <-- Reset to default target
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Configure Camera Input Controls
    // ---------------------------------------------------------------
    function configureCameraInputs() {
        if (!flyCamera) return;                                              // <-- Validate camera exists
        
        // KEEP DEFAULT INPUTS BUT CONFIGURE THEM
        const inputs = flyCamera.inputs;                                     // <-- Get input manager
        
        // CONFIGURE KEYBOARD INPUT
        if (inputs.attached.keyboard) {
            inputs.attached.keyboard.keysUp = [87];                          // <-- W key for forward
            inputs.attached.keyboard.keysDown = [83];                        // <-- S key for backward
            inputs.attached.keyboard.keysLeft = [65];                        // <-- A key for left
            inputs.attached.keyboard.keysRight = [68];                       // <-- D key for right
        }
        
        // CONFIGURE MOUSE INPUT
        if (inputs.attached.mouse) {
            inputs.attached.mouse.angularSensibility = ANGULAR_SENSIBILITY;  // <-- Set mouse sensitivity
            inputs.attached.mouse.touchEnabled = true;                       // <-- Enable touch support
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Public API Methods
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Fly Navigation System
    // ------------------------------------------------------------
    function initialize(babylonScene, targetCanvas) {
        console.log("Initializing Fly Navigation System");                   // <-- Log initialization
        
        scene = babylonScene;                                                // <-- Store scene reference
        canvas = targetCanvas;                                               // <-- Store canvas reference
        
        // CREATE FLY CAMERA
        flyCamera = createFlyCamera();                                       // <-- Create camera instance
        if (!flyCamera) {
            console.error("Failed to create fly camera");                    // <-- Log failure
            return false;                                                    // <-- Return failure status
        }
        
        // CONFIGURE CAMERA INPUTS
        configureCameraInputs();                                             // <-- Setup input controls
        
        console.log("Fly Navigation System initialized successfully");       // <-- Log success
        return true;                                                         // <-- Return success status
    }
    // ---------------------------------------------------------------

    // FUNCTION | Enable Fly Navigation Mode
    // ------------------------------------------------------------
    function enable() {
        if (!flyCamera || !scene || !canvas) return;                        // <-- Validate prerequisites
        
        isEnabled = true;                                                    // <-- Set enabled flag
        
        // ACTIVATE FLY CAMERA
        scene.activeCamera = flyCamera;                                      // <-- Set as active camera
        flyCamera.attachControl(canvas, true);                               // <-- Attach controls
        
        console.log("Fly navigation enabled");                               // <-- Log activation
    }
    // ---------------------------------------------------------------

    // FUNCTION | Disable Fly Navigation Mode
    // ------------------------------------------------------------
    function disable() {
        isEnabled = false;                                                   // <-- Clear enabled flag
        
        // DETACH CAMERA CONTROLS
        if (flyCamera && canvas) {
            flyCamera.detachControl(canvas);                                 // <-- Remove controls
        }
        
        console.log("Fly navigation disabled");                              // <-- Log deactivation
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Current Camera for External Use
    // ---------------------------------------------------------------
    function getCamera() {
        return flyCamera;                                                    // <-- Return camera reference
    }
    // ---------------------------------------------------------------

    // FUNCTION | Reset Camera to Default Position
    // ---------------------------------------------------------------
    function reset() {
        resetCameraView();                                                   // <-- Call reset function
        console.log("Fly camera reset to default view");                     // <-- Log reset
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Camera Position
    // ---------------------------------------------------------------
    function setPosition(positionVector) {
        if (!flyCamera || !positionVector) return;                          // <-- Validate inputs
        
        flyCamera.position = positionVector.clone();                         // <-- Set new position
        defaultPosition = positionVector.clone();                            // <-- Update default position
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Camera Target
    // ---------------------------------------------------------------
    function setTarget(targetVector) {
        if (!flyCamera || !targetVector) return;                            // <-- Validate inputs
        
        flyCamera.setTarget(targetVector);                                   // <-- Set new target
        defaultTarget = targetVector.clone();                                // <-- Update default target
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Movement Speed
    // ---------------------------------------------------------------
    function setSpeed(speed) {
        if (!flyCamera || typeof speed !== 'number') return;                // <-- Validate inputs
        
        flyCamera.speed = speed;                                             // <-- Update movement speed
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Mouse Sensitivity
    // ---------------------------------------------------------------
    function setSensitivity(sensitivity) {
        if (!flyCamera || typeof sensitivity !== 'number') return;           // <-- Validate inputs
        
        flyCamera.angularSensibility = sensitivity;                          // <-- Update mouse sensitivity
        
        // UPDATE MOUSE INPUT IF ATTACHED
        if (flyCamera.inputs.attached.mouse) {
            flyCamera.inputs.attached.mouse.angularSensibility = sensitivity; // <-- Apply to mouse input
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Clean Up Resources
    // ---------------------------------------------------------------
    function dispose() {
        disable();                                                           // <-- Ensure disabled first
        
        // DISPOSE CAMERA
        if (flyCamera) {
            flyCamera.dispose();                                             // <-- Clean up camera
            flyCamera = null;                                                // <-- Clear reference
        }
        
        // CLEAR REFERENCES
        scene = null;                                                        // <-- Clear scene reference
        canvas = null;                                                       // <-- Clear canvas reference
        defaultPosition = null;                                              // <-- Clear position reference
        defaultTarget = null;                                                // <-- Clear target reference
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Export
// -----------------------------------------------------------------------------

    // EXPORT PUBLIC API
    window.TrueVision3D.NavigationModes.FlyNavigation = {
        initialize: initialize,                                              // <-- Initialization method
        enable: enable,                                                      // <-- Enable navigation mode
        disable: disable,                                                    // <-- Disable navigation mode
        getCamera: getCamera,                                                // <-- Get camera reference
        reset: reset,                                                        // <-- Reset camera view
        setPosition: setPosition,                                            // <-- Set camera position
        setTarget: setTarget,                                                // <-- Set camera target
        setSpeed: setSpeed,                                                  // <-- Set movement speed
        setSensitivity: setSensitivity,                                      // <-- Set mouse sensitivity
        dispose: dispose,                                                    // <-- Cleanup method
        isEnabled: () => isEnabled                                           // <-- Check enabled state
    };

// endregion -------------------------------------------------------------------

})(); 