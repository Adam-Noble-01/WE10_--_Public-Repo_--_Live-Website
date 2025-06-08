// =============================================================================
// VALEDESIGNSUITE - WALK NAVIGATION SYSTEM LOGIC
// =============================================================================
//
// FILE       : NavMode_WalkNavigationSystemLogic.js
// NAMESPACE  : TrueVision3D.NavigationModes
// MODULE     : WalkNavigation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : First-person walk-through navigation for architectural visualization
// CREATED    : 2025
//
// DESCRIPTION:
// - Implements a walk-through navigation system using Babylon.js UniversalCamera
// - Provides ground-level movement with collision detection
// - Supports WASD movement keys with gravity and jumping
// - Includes configurable walk speed and eye height settings
// - Realistic navigation mode for experiencing spaces at human scale
//
// INTEGRATION WITH UI MENU SYSTEM:
// - This module provides the camera and navigation logic for walk mode
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
// - Initial implementation for walk-through navigation
// - Added gravity simulation and collision detection
// - Implemented configurable walk speed and eye height
// - Added jump functionality with space bar
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
    const DEFAULT_EYE_HEIGHT           = 1.7;                               // <-- Eye height in meters
    const DEFAULT_WALK_SPEED           = 0.15;                              // <-- Walking speed multiplier
    const DEFAULT_RUN_SPEED            = 0.35;                              // <-- Running speed multiplier
    const DEFAULT_JUMP_HEIGHT          = 0.3;                               // <-- Jump height in meters
    const MOVEMENT_INERTIA             = 0.9;                               // <-- Movement inertia factor
    const ANGULAR_SENSIBILITY          = 2000;                              // <-- Mouse look sensitivity
    const GRAVITY_FORCE                = -0.2;                              // <-- Gravity acceleration
    const COLLISION_ELLIPSOID          = new BABYLON.Vector3(0.5, 0.85, 0.5); // <-- Collision shape
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Variables and State Management
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Core Navigation State
    // ------------------------------------------------------------
    let scene                          = null;                              // <-- Babylon.js scene reference
    let canvas                         = null;                              // <-- HTML canvas element
    let walkCamera                     = null;                              // <-- UniversalCamera instance
    let isEnabled                      = false;                             // <-- Navigation mode enabled state
    let defaultPosition                = null;                              // <-- Default camera position
    let defaultTarget                  = null;                              // <-- Default camera target
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Movement State
    // ------------------------------------------------------------
    let isRunning                      = false;                             // <-- Running state flag
    let isJumping                      = false;                             // <-- Jumping state flag
    let verticalVelocity               = 0;                                 // <-- Current vertical velocity
    let groundLevel                    = 0;                                 // <-- Ground height reference
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Camera Creation and Management
// -----------------------------------------------------------------------------

    // FUNCTION | Create and Configure Walk Camera
    // ------------------------------------------------------------
    function createWalkCamera() {
        if (!scene) return null;                                            // <-- Validate scene exists
        
        // CREATE UNIVERSAL CAMERA FOR WALK MODE
        walkCamera = new BABYLON.UniversalCamera("walkCamera", 
            new BABYLON.Vector3(5, DEFAULT_EYE_HEIGHT, 10), scene);          // <-- Create at eye height
            
        // CONFIGURE CAMERA MOVEMENT PROPERTIES
        walkCamera.speed = DEFAULT_WALK_SPEED;                               // <-- Set walking speed
        walkCamera.inertia = MOVEMENT_INERTIA;                               // <-- Set movement inertia
        walkCamera.angularSensibility = ANGULAR_SENSIBILITY;                 // <-- Set mouse sensitivity
        
        // CONFIGURE CAMERA CLIPPING PLANES
        walkCamera.minZ = 0.1;                                               // <-- Near clipping plane
        walkCamera.maxZ = 5000;                                              // <-- Far clipping plane
        
        // CONFIGURE COLLISION DETECTION
        walkCamera.checkCollisions = true;                                   // <-- Enable collision detection
        walkCamera.applyGravity = true;                                      // <-- Enable gravity
        walkCamera.ellipsoid = COLLISION_ELLIPSOID.clone();                  // <-- Set collision shape
        
        // STORE DEFAULT POSITION AND TARGET
        defaultPosition = new BABYLON.Vector3(5, DEFAULT_EYE_HEIGHT, 10);    // <-- Default spawn position
        defaultTarget = new BABYLON.Vector3(5, DEFAULT_EYE_HEIGHT, 0);       // <-- Default look target
        
        return walkCamera;                                                   // <-- Return configured camera
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Reset Camera to Default View
    // ---------------------------------------------------------------
    function resetCameraView() {
        if (!walkCamera) return;                                             // <-- Validate camera exists
        
        walkCamera.position = defaultPosition.clone();                       // <-- Reset to default position
        walkCamera.setTarget(defaultTarget.clone());                        // <-- Reset to default target
        verticalVelocity = 0;                                                // <-- Reset vertical velocity
        isJumping = false;                                                   // <-- Reset jump state
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Configure Camera Input Controls
    // ---------------------------------------------------------------
    function configureCameraInputs() {
        if (!walkCamera) return;                                             // <-- Validate camera exists
        
        // CLEAR EXISTING INPUTS
        walkCamera.inputs.clear();                                           // <-- Remove all default inputs
        
        // ADD KEYBOARD INPUT
        const keyboard = new BABYLON.FreeCameraKeyboardMoveInput();          // <-- Create keyboard input
        keyboard.keysUp = [87];                                              // <-- W key for forward
        keyboard.keysDown = [83];                                            // <-- S key for backward
        keyboard.keysLeft = [65];                                            // <-- A key for left
        keyboard.keysRight = [68];                                           // <-- D key for right
        walkCamera.inputs.add(keyboard);                                     // <-- Add keyboard input
        
        // ADD MOUSE INPUT
        const mouse = new BABYLON.FreeCameraMouseInput();                    // <-- Create mouse input
        mouse.angularSensibility = ANGULAR_SENSIBILITY;                      // <-- Set mouse sensitivity
        mouse.touchEnabled = true;                                           // <-- Enable touch support
        walkCamera.inputs.add(mouse);                                        // <-- Add mouse input
        
        // ATTACH CONTROLS
        walkCamera.inputs.attachElement(canvas);                             // <-- Attach to canvas
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Setup Movement Event Handlers
    // ---------------------------------------------------------------
    function setupMovementHandlers() {
        if (!canvas) return;                                                 // <-- Validate canvas exists
        
        // KEYBOARD EVENT HANDLERS
        canvas.addEventListener('keydown', handleKeyDown);                   // <-- Key press handler
        canvas.addEventListener('keyup', handleKeyUp);                       // <-- Key release handler
        
        // UPDATE GROUND LEVEL REFERENCE
        updateGroundLevel();                                                 // <-- Set initial ground level
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Key Down Events
    // ---------------------------------------------------------------
    function handleKeyDown(event) {
        if (!isEnabled || !walkCamera) return;                              // <-- Check if active
        
        switch(event.keyCode) {
            case 16:                                                         // <-- Shift key for running
                isRunning = true;
                walkCamera.speed = DEFAULT_RUN_SPEED;                        // <-- Increase speed
                break;
                
            case 32:                                                         // <-- Space key for jumping
                if (!isJumping && Math.abs(verticalVelocity) < 0.01) {      // <-- Check if on ground
                    verticalVelocity = DEFAULT_JUMP_HEIGHT;                  // <-- Apply jump velocity
                    isJumping = true;                                        // <-- Set jumping state
                }
                event.preventDefault();                                      // <-- Prevent page scroll
                break;
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Key Up Events
    // ---------------------------------------------------------------
    function handleKeyUp(event) {
        if (!isEnabled || !walkCamera) return;                              // <-- Check if active
        
        switch(event.keyCode) {
            case 16:                                                         // <-- Shift key released
                isRunning = false;
                walkCamera.speed = DEFAULT_WALK_SPEED;                       // <-- Reset to walk speed
                break;
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Update Ground Level Reference
    // ---------------------------------------------------------------
    function updateGroundLevel() {
        if (!scene || !scene.environment?.ground) {
            groundLevel = 0;                                                 // <-- Default ground level
            return;
        }
        
        const ground = scene.environment.ground;                             // <-- Get ground mesh
        groundLevel = ground.position.y + 0.1;                              // <-- Set ground level with buffer
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Apply Gravity and Jump Physics
    // ---------------------------------------------------------------
    function applyPhysics() {
        if (!walkCamera || !isEnabled) return;                              // <-- Check if active
        
        // APPLY GRAVITY
        verticalVelocity += GRAVITY_FORCE * scene.getEngine().getDeltaTime() / 1000; // <-- Add gravity
        
        // UPDATE VERTICAL POSITION
        const newY = walkCamera.position.y + verticalVelocity;               // <-- Calculate new Y position
        
        // CHECK GROUND COLLISION
        if (newY <= groundLevel + DEFAULT_EYE_HEIGHT) {                     // <-- Hit ground
            walkCamera.position.y = groundLevel + DEFAULT_EYE_HEIGHT;        // <-- Set to ground level
            verticalVelocity = 0;                                            // <-- Reset velocity
            isJumping = false;                                               // <-- Clear jump state
        } else {
            walkCamera.position.y = newY;                                    // <-- Apply new position
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Public API Methods
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Walk Navigation System
    // ------------------------------------------------------------
    function initialize(babylonScene, targetCanvas) {
        console.log("Initializing Walk Navigation System");                  // <-- Log initialization
        
        scene = babylonScene;                                                // <-- Store scene reference
        canvas = targetCanvas;                                               // <-- Store canvas reference
        
        // CREATE WALK CAMERA
        walkCamera = createWalkCamera();                                     // <-- Create camera instance
        if (!walkCamera) {
            console.error("Failed to create walk camera");                   // <-- Log failure
            return false;                                                    // <-- Return failure status
        }
        
        // CONFIGURE CAMERA INPUTS
        configureCameraInputs();                                             // <-- Setup input controls
        setupMovementHandlers();                                             // <-- Setup event handlers
        
        // SETUP PHYSICS UPDATE LOOP
        scene.registerBeforeRender(() => {
            if (isEnabled) {
                applyPhysics();                                              // <-- Apply gravity/jump physics
            }
        });
        
        console.log("Walk Navigation System initialized successfully");      // <-- Log success
        return true;                                                         // <-- Return success status
    }
    // ---------------------------------------------------------------

    // FUNCTION | Enable Walk Navigation Mode
    // ------------------------------------------------------------
    function enable() {
        if (!walkCamera || !scene || !canvas) return;                       // <-- Validate prerequisites
        
        isEnabled = true;                                                    // <-- Set enabled flag
        
        // ACTIVATE WALK CAMERA
        scene.activeCamera = walkCamera;                                     // <-- Set as active camera
        walkCamera.attachControl(canvas, true);                              // <-- Attach controls
        
        // UPDATE GROUND LEVEL
        updateGroundLevel();                                                 // <-- Refresh ground reference
        
        console.log("Walk navigation enabled");                              // <-- Log activation
    }
    // ---------------------------------------------------------------

    // FUNCTION | Disable Walk Navigation Mode
    // ------------------------------------------------------------
    function disable() {
        isEnabled = false;                                                   // <-- Clear enabled flag
        isRunning = false;                                                   // <-- Reset running state
        isJumping = false;                                                   // <-- Reset jumping state
        
        // DETACH CAMERA CONTROLS
        if (walkCamera && canvas) {
            walkCamera.detachControl(canvas);                                // <-- Remove controls
        }
        
        // RESET WALK SPEED
        if (walkCamera) {
            walkCamera.speed = DEFAULT_WALK_SPEED;                           // <-- Reset to default speed
        }
        
        console.log("Walk navigation disabled");                             // <-- Log deactivation
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Current Camera for External Use
    // ---------------------------------------------------------------
    function getCamera() {
        return walkCamera;                                                   // <-- Return camera reference
    }
    // ---------------------------------------------------------------

    // FUNCTION | Reset Camera to Default Position
    // ---------------------------------------------------------------
    function reset() {
        resetCameraView();                                                   // <-- Call reset function
        console.log("Walk camera reset to default view");                    // <-- Log reset
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Camera Position
    // ---------------------------------------------------------------
    function setPosition(positionVector) {
        if (!walkCamera || !positionVector) return;                         // <-- Validate inputs
        
        walkCamera.position = positionVector.clone();                        // <-- Set new position
        walkCamera.position.y = Math.max(walkCamera.position.y, 
                                        groundLevel + DEFAULT_EYE_HEIGHT);   // <-- Ensure above ground
        defaultPosition = walkCamera.position.clone();                       // <-- Update default position
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Camera Target
    // ---------------------------------------------------------------
    function setTarget(targetVector) {
        if (!walkCamera || !targetVector) return;                           // <-- Validate inputs
        
        walkCamera.setTarget(targetVector);                                  // <-- Set new target
        defaultTarget = targetVector.clone();                                // <-- Update default target
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Walk Speed
    // ---------------------------------------------------------------
    function setWalkSpeed(speed) {
        if (!walkCamera || typeof speed !== 'number') return;               // <-- Validate inputs
        
        walkCamera.speed = speed;                                            // <-- Update walk speed
        if (!isRunning) {
            walkCamera.speed = speed;                                        // <-- Apply if not running
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Eye Height
    // ---------------------------------------------------------------
    function setEyeHeight(height) {
        if (!walkCamera || typeof height !== 'number') return;              // <-- Validate inputs
        
        const currentHeight = walkCamera.position.y - groundLevel;           // <-- Get current height
        const heightDiff = height - currentHeight;                          // <-- Calculate difference
        walkCamera.position.y += heightDiff;                                 // <-- Apply height change
        walkCamera.ellipsoid.y = height / 2;                                // <-- Update collision shape
    }
    // ---------------------------------------------------------------

    // FUNCTION | Clean Up Resources
    // ---------------------------------------------------------------
    function dispose() {
        disable();                                                           // <-- Ensure disabled first
        
        // REMOVE EVENT LISTENERS
        if (canvas) {
            canvas.removeEventListener('keydown', handleKeyDown);            // <-- Remove key down
            canvas.removeEventListener('keyup', handleKeyUp);                // <-- Remove key up
        }
        
        // DISPOSE CAMERA
        if (walkCamera) {
            walkCamera.dispose();                                            // <-- Clean up camera
            walkCamera = null;                                               // <-- Clear reference
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
    window.TrueVision3D.NavigationModes.WalkNavigation = {
        initialize: initialize,                                              // <-- Initialization method
        enable: enable,                                                      // <-- Enable navigation mode
        disable: disable,                                                    // <-- Disable navigation mode
        getCamera: getCamera,                                                // <-- Get camera reference
        reset: reset,                                                        // <-- Reset camera view
        setPosition: setPosition,                                            // <-- Set camera position
        setTarget: setTarget,                                                // <-- Set camera target
        setWalkSpeed: setWalkSpeed,                                          // <-- Set walk speed
        setEyeHeight: setEyeHeight,                                          // <-- Set eye height
        dispose: dispose,                                                    // <-- Cleanup method
        isEnabled: () => isEnabled                                           // <-- Check enabled state
    };

// endregion -------------------------------------------------------------------

})();
