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

    // MODULE CONSTANTS | Camera Configuration Defaults (Fallback Values)
    // ------------------------------------------------------------
    const FALLBACK_POSITION            = new BABYLON.Vector3(0, 3, 3);       // <-- 3m eye height, 3m back from origin
    const FALLBACK_TARGET              = BABYLON.Vector3.Zero();             // <-- Fallback look target
    const MOVEMENT_SPEED               = 0.7;                                // <-- Movement speed multiplier
    const MOVEMENT_INERTIA             = 0.1;                                // <-- Movement inertia factor
    const ANGULAR_SENSIBILITY          = 2500;                               // <-- Mouse look sensitivity (2x more aggressive)
    const MM_TO_METERS                 = 0.001;                              // <-- Millimeter to meter conversion
    const DEGREES_TO_RADIANS           = Math.PI / 180;                      // <-- Degree to radian conversion
    const FALLBACK_EYE_HEIGHT_MM       = 3000;                               // <-- Fallback eye height in millimeters
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Configuration Loaded from MainAppConfig.json
    // ------------------------------------------------------------
    let configPosition                 = null;                              // <-- Position loaded from config
    let configRotation                 = null;                              // <-- Rotation loaded from config
    let configurationLoaded            = false;                             // <-- Config loading state
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
// REGION | Configuration Loading and Processing System
// -----------------------------------------------------------------------------

    // FUNCTION | Load Fly Navigation Configuration from MainAppConfig
    // ------------------------------------------------------------
    function loadFlyNavigationConfiguration() {
        try {
            console.log("=== FLY NAVIGATION CONFIG LOADING ===");           // <-- Debug header
            
            const appConfig = window.TrueVision3D?.AppConfig;                // <-- Get app configuration
            const flyConfig = appConfig?.AppConfig?.AppConfig_NavMode?.AppNavMode_Fly?.NavMode_FlyDefaultInitCoords;
            
            if (!flyConfig) {
                console.warn("JSON config not found - using fallback values (3000mm eye height)"); 
                configPosition = new BABYLON.Vector3(
                    0, 
                    FALLBACK_EYE_HEIGHT_MM * MM_TO_METERS, 
                    3
                );                                                           // <-- Fallback: 0, 3000mm=3m, 3m
                configRotation = new BABYLON.Vector3(0, Math.PI, 0);         // <-- Y rotation for 180° turn
                console.log("Using fallback - Position:", configPosition, "Rotation:", configRotation);
                return false;                                                
            }
            
            // EXTRACT AND CONVERT POSITION VALUES FROM MILLIMETERS TO METERS
            const posX = parseFloat(flyConfig.DefaultInitCoordX || "0") * MM_TO_METERS;                          // <-- X coordinate
            const posEyeHeight = parseFloat(flyConfig.DefaultInitCoordEyeHeight || "3000") * MM_TO_METERS;       // <-- Eye height (explicit)
            const posZ = parseFloat(flyConfig.DefaultInitCoordZ || "3000") * MM_TO_METERS;                       // <-- Z coordinate
            configPosition = new BABYLON.Vector3(posX, posEyeHeight, posZ);  // <-- Create position vector with explicit eye height
            
            // EXTRACT AND CONVERT ROTATION VALUES
            const rotX = parseFloat(flyConfig.DefaultInitRotationX || "0") * DEGREES_TO_RADIANS;   // <-- Pitch
            const rotY = parseFloat(flyConfig.DefaultInitRotationY || "0") * DEGREES_TO_RADIANS;   // <-- Yaw  
            const rotZ = parseFloat(flyConfig.DefaultInitRotationZ || "180") * DEGREES_TO_RADIANS; // <-- Roll from JSON
            
            // REMAP Z ROTATION TO Y ROTATION FOR PROPER 180° TURN
            const correctedRotY = rotY + rotZ;                               // <-- Add Z rotation to Y rotation
            configRotation = new BABYLON.Vector3(rotX, correctedRotY, 0);    // <-- Use Y for 180° turn, zero roll
            
            configurationLoaded = true;                                      
            console.log("JSON CONFIG LOADED with explicit eye height:");
            console.log("  Eye Height (mm):", flyConfig.DefaultInitCoordEyeHeight);
            console.log("  Eye Height (m):", posEyeHeight);
            console.log("  Final Position:", configPosition, "Rotation:", configRotation);
            
            return true;                                                     
            
        } catch (error) {
            console.error("Error loading fly navigation configuration:", error); 
            configPosition = new BABYLON.Vector3(
                0, 
                FALLBACK_EYE_HEIGHT_MM * MM_TO_METERS, 
                3
            );                                                               // <-- Fallback with 3000mm eye height
            configRotation = new BABYLON.Vector3(0, Math.PI, 0);             // <-- Y rotation for 180° turn
            console.log("Error fallback (3000mm eye height) - Position:", configPosition, "Rotation:", configRotation);
            return false;                                                    
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Apply Configuration to Camera Position and Rotation
    // ------------------------------------------------------------
    function applyCameraConfiguration() {
        if (!flyCamera || !configPosition || !configRotation) {
            console.error("Cannot apply config - missing camera, position, or rotation");
            return;                                                          
        }
        
        console.log("=== APPLYING FLY CAMERA CONFIGURATION ===");           
        console.log("Applying position:", configPosition);                  
        console.log("Applying rotation:", configRotation);                  
        
        // SET CAMERA POSITION FROM CONFIGURATION
        flyCamera.position = configPosition.clone();                         // <-- Apply position
        
        // APPLY ROTATION FROM CONFIGURATION (USE JSON VALUES, NOT setTarget)
        flyCamera.rotation = configRotation.clone();                         // <-- Use JSON rotation values
        
        // UPDATE DEFAULT POSITION AND ROTATION FOR RESET FUNCTIONALITY
        defaultPosition = configPosition.clone();                           
        
        // CALCULATE TARGET BASED ON POSITION AND ROTATION FOR RESET
        const forward = new BABYLON.Vector3(0, 0, 1);                        // <-- Default forward vector
        const rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(
            configRotation.y, 
            configRotation.x, 
            configRotation.z
        );                                                                   // <-- Create rotation matrix
        const transformedForward = BABYLON.Vector3.TransformCoordinates(forward, rotationMatrix); // <-- Transform forward vector
        defaultTarget = configPosition.add(transformedForward);              // <-- Calculate target for reset
        
        console.log("Final camera state:");
        console.log("  Position:", flyCamera.position);
        console.log("  Rotation (radians):", flyCamera.rotation);
        console.log("  Rotation (degrees):", {
            x: flyCamera.rotation.x * (180/Math.PI),
            y: flyCamera.rotation.y * (180/Math.PI), 
            z: flyCamera.rotation.z * (180/Math.PI)
        });
        console.log("=== CONFIGURATION APPLIED SUCCESSFULLY ===");          
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Camera Creation and Management
// -----------------------------------------------------------------------------

    // FUNCTION | Create and Configure Fly Camera
    // ------------------------------------------------------------
    function createFlyCamera() {
        if (!scene) return null;                                            // <-- Validate scene exists
        
        console.log("=== CREATING FLY CAMERA ===");                        // <-- Debug header
        
        // LOAD CONFIGURATION FIRST (SETS configPosition AND configRotation)
        const configFromJson = loadFlyNavigationConfiguration();            // <-- Load config from JSON
        console.log("Config loaded from JSON:", configFromJson);            // <-- Debug log
        
        // ENSURE WE HAVE VALID CONFIGURATION (JSON OR FALLBACK)
        if (!configPosition || !configRotation) {
            console.error("No valid configuration available - using emergency fallback");
            configPosition = new BABYLON.Vector3(0, 0, 3);                   // <-- Emergency fallback
            configRotation = new BABYLON.Vector3(0, 0, Math.PI);             // <-- Emergency fallback
        }
        
        // CREATE FREE CAMERA FOR FLY-THROUGH MODE
        flyCamera = new BABYLON.FreeCamera("flyCamera", 
            configPosition.clone(), scene);                                 // <-- Create at configured position
            
        // CONFIGURE CAMERA MOVEMENT PROPERTIES
        flyCamera.speed = MOVEMENT_SPEED;                                    // <-- Set movement speed
        flyCamera.inertia = MOVEMENT_INERTIA;                                // <-- Set movement inertia
        flyCamera.angularSensibility = ANGULAR_SENSIBILITY;                  // <-- Set mouse sensitivity
        
        // CONFIGURE CAMERA CLIPPING PLANES
        flyCamera.minZ = 0.1;                                                // <-- Near clipping plane
        flyCamera.maxZ = 10000;                                              // <-- Far clipping plane
        
        // CONFIGURE CAMERA COLLISION DETECTION
        flyCamera.checkCollisions = false;                                   // <-- Disable collisions for free movement
        
        console.log("Camera created, now applying full configuration...");   // <-- Debug log
        
        // APPLY FULL CONFIGURATION TO CAMERA (ALWAYS RUNS)
        applyCameraConfiguration();                                          // <-- Apply config position and rotation
        
        console.log("=== FLY CAMERA CREATION COMPLETE ===");                // <-- Debug footer
        return flyCamera;                                                    // <-- Return configured camera
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Reset Camera to Default View
    // ---------------------------------------------------------------
    function resetCameraView() {
        if (!flyCamera) return;                                              // <-- Validate camera exists
        
        flyCamera.position = defaultPosition.clone();                        // <-- Reset to configured position
        if (configRotation && configurationLoaded) {
            flyCamera.rotation = configRotation.clone();                     // <-- Reset to configured rotation
        } else {
            flyCamera.setTarget(defaultTarget.clone());                      // <-- Reset to calculated target
        }
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
            inputs.attached.keyboard.keysUpward = [69];                      // <-- E key for ascend vertically
            inputs.attached.keyboard.keysDownward = [81];                    // <-- Q key for descend vertically
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