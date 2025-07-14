// =============================================================================
// VALEDESIGNSUITE - ORBIT NAVIGATION SYSTEM LOGIC
// =============================================================================
//
// FILE       : NavMode_OrbitNavigationSystemLogic.js
// NAMESPACE  : TrueVision3D.NavigationModes
// MODULE     : OrbitNavigation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Orbit-style camera navigation for architectural visualization
// CREATED    : 2025
//
// DESCRIPTION:
// - Implements an orbit camera navigation system using Babylon.js ArcRotateCamera
// - Allows rotation around a fixed target point with mouse/touch controls
// - Provides zoom in/out functionality with mouse wheel
// - Includes camera position limits to prevent navigation issues
// - Standard navigation mode for examining architectural models from all angles
//
// INTEGRATION WITH UI MENU SYSTEM:
// - This module provides the camera and navigation logic for orbit mode
// - The UiMenu_NavModeButtonManager.js handles the toolbar button for this mode
// - When enabled via the UI button, this module takes control of the camera
// - The UI manager coordinates switching between this and other navigation modes
// - This module does NOT create its own UI controls (uses mouse only)
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
    const DEFAULT_ALPHA                = BABYLON.Tools.ToRadians(45);        // <-- Initial horizontal rotation
    const DEFAULT_BETA                 = BABYLON.Tools.ToRadians(60);        // <-- Initial vertical rotation
    const DEFAULT_RADIUS               = 30;                                 // <-- Initial distance from target
    const LOWER_RADIUS_LIMIT           = 3;                                  // <-- Minimum zoom distance
    const UPPER_RADIUS_LIMIT           = 50;                                 // <-- Maximum zoom distance
    const CAMERA_OFFSET                = 10;                                 // <-- Additional camera positioning offset
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Variables and State Management
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Core Navigation State
    // ------------------------------------------------------------
    let scene                          = null;                              // <-- Babylon.js scene reference
    let canvas                         = null;                              // <-- HTML canvas element
    let orbitCamera                    = null;                              // <-- ArcRotateCamera instance
    let isEnabled                      = false;                             // <-- Navigation mode enabled state
    let defaultPosition                = null;                              // <-- Default camera position
    let defaultTarget                  = null;                              // <-- Default camera target
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Camera Creation and Management
// -----------------------------------------------------------------------------

    // FUNCTION | Create and Configure Orbit Camera
    // ------------------------------------------------------------
    function createOrbitCamera() {
        if (!scene) return null;                                            // <-- Validate scene exists
        
        // CREATE ARC ROTATE CAMERA FOR ORBIT MODE
        orbitCamera = new BABYLON.ArcRotateCamera("orbitCamera", 
            DEFAULT_ALPHA,                                                   // <-- Initial alpha angle
            DEFAULT_BETA,                                                    // <-- Initial beta angle
            DEFAULT_RADIUS,                                                  // <-- Initial radius distance
            BABYLON.Vector3.Zero(),                                          // <-- Target at origin
            scene);                                                          // <-- Scene reference
            
        // CONFIGURE CAMERA LIMITS AND BEHAVIOR
        orbitCamera.lowerRadiusLimit = LOWER_RADIUS_LIMIT;                  // <-- Minimum zoom distance
        orbitCamera.upperRadiusLimit = UPPER_RADIUS_LIMIT;                  // <-- Maximum zoom distance
        orbitCamera.wheelPrecision = 50;                                     // <-- Mouse wheel sensitivity
        orbitCamera.pinchPrecision = 50;                                     // <-- Touch pinch sensitivity
        
        // CONFIGURE CAMERA INERTIA
        orbitCamera.inertialAlphaOffset = 0;                                // <-- Horizontal rotation inertia
        orbitCamera.inertialBetaOffset = 0;                                 // <-- Vertical rotation inertia
        orbitCamera.inertialRadiusOffset = 0;                               // <-- Zoom inertia
        orbitCamera.inertialPanningX = 0;                                   // <-- Pan X inertia
        orbitCamera.inertialPanningY = 0;                                   // <-- Pan Y inertia
        
        // NOTE: Default position and target are set dynamically during initialization
        // based on first waypoint position for consistency across navigation modes
        
        return orbitCamera;                                                  // <-- Return configured camera
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Reset Camera to Default View
    // ---------------------------------------------------------------
    function resetCameraView() {
        if (!orbitCamera) return;                                            // <-- Validate camera exists
        
        orbitCamera.setPosition(defaultPosition.clone());                    // <-- Reset to default position
        orbitCamera.setTarget(defaultTarget.clone());                        // <-- Reset to default target
        orbitCamera.alpha = DEFAULT_ALPHA;                                   // <-- Reset horizontal rotation
        orbitCamera.beta = DEFAULT_BETA;                                     // <-- Reset vertical rotation
        orbitCamera.radius = DEFAULT_RADIUS;                                 // <-- Reset zoom distance
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Configure Camera Input Controls
    // ---------------------------------------------------------------
    function configureCameraInputs() {
        if (!orbitCamera) return;                                            // <-- Validate camera exists
        
        // KEEP DEFAULT INPUTS BUT CONFIGURE THEM
        const inputs = orbitCamera.inputs;                                  // <-- Get input manager
        
        // CONFIGURE MOUSE WHEEL INPUT
        if (inputs.attached.mousewheel) {
            inputs.attached.mousewheel.wheelPrecision = 50;                  // <-- Set wheel sensitivity
        }
        
        // CONFIGURE POINTER INPUT
        if (inputs.attached.pointers) {
            inputs.attached.pointers.angularSensibilityX = 1000;            // <-- Horizontal rotation sensitivity
            inputs.attached.pointers.angularSensibilityY = 1000;            // <-- Vertical rotation sensitivity
            inputs.attached.pointers.panningSensibility = 100;              // <-- Panning sensitivity
            inputs.attached.pointers.useNaturalPinchZoom = true;            // <-- Natural pinch zoom behavior
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Public API Methods
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Orbit Navigation System
    // ------------------------------------------------------------
    async function initialize(babylonScene, targetCanvas) {
        console.log("Initializing Orbit Navigation System");                 // <-- Log initialization
        
        scene = babylonScene;                                                // <-- Store scene reference
        canvas = targetCanvas;                                               // <-- Store canvas reference
        
        // GET FIRST WAYPOINT POSITION FOR CONSISTENT STARTING POINT
        const waypointNav = window.TrueVision3D?.NavigationModes?.WaypointNavigation;
        if (waypointNav) {
            try {
                const firstWaypoint = await waypointNav.getFirstWaypointPosition();
                if (firstWaypoint) {
                    // UPDATE DEFAULT POSITION AND TARGET FROM WAYPOINT DATA
                    defaultPosition = firstWaypoint.position.clone();
                    defaultTarget = firstWaypoint.target.clone();
                    console.log("Orbit navigation using first waypoint position:", defaultPosition);
                } else {
                    console.warn("Could not get first waypoint position, using fallback");
                }
            } catch (error) {
                console.warn("Error getting first waypoint position:", error);
            }
        }
        
        // SET FALLBACK VALUES IF WAYPOINT LOADING FAILED
        if (!defaultPosition) {
            defaultPosition = new BABYLON.Vector3(0, 10, -30 - CAMERA_OFFSET); // <-- Fallback position
            defaultTarget = BABYLON.Vector3.Zero();                            // <-- Fallback target
            console.log("Orbit navigation using fallback position:", defaultPosition);
        }
        
        // CREATE ORBIT CAMERA
        orbitCamera = createOrbitCamera();                                   // <-- Create camera instance
        if (!orbitCamera) {
            console.error("Failed to create orbit camera");                  // <-- Log failure
            return false;                                                    // <-- Return failure status
        }
        
        // CONFIGURE CAMERA INPUTS
        configureCameraInputs();                                             // <-- Setup input controls
        
        console.log("Orbit Navigation System initialized successfully");     // <-- Log success
        return true;                                                         // <-- Return success status
    }
    // ---------------------------------------------------------------

    // FUNCTION | Enable Orbit Navigation Mode
    // ---------------------------------------------------------------
    function enable() {
        if (!orbitCamera || !scene) return;                                 // <-- Validate prerequisites
        
        // ENSURE CANVAS IS SET IF NOT ALREADY
        if (!canvas) {
            canvas = scene.getEngine().getRenderingCanvas();                // <-- Get canvas from scene engine
            console.log("Orbit Navigation: Canvas retrieved from scene engine"); // <-- Debug log
        }
        
        if (!canvas) return;                                                 // <-- Check canvas after retrieval attempt
        
        isEnabled = true;                                                    // <-- Set enabled flag
        
        // ACTIVATE ORBIT CAMERA
        scene.activeCamera = orbitCamera;                                    // <-- Set as active camera
        orbitCamera.attachControl(canvas, true);                             // <-- Attach controls
        
        console.log("Orbit navigation enabled");                             // <-- Log activation
    }
    // ---------------------------------------------------------------

    // FUNCTION | Disable Orbit Navigation Mode
    // ---------------------------------------------------------------
    function disable() {
        isEnabled = false;                                                   // <-- Clear enabled flag
        
        // DETACH CAMERA CONTROLS
        if (orbitCamera && canvas) {
            orbitCamera.detachControl(canvas);                               // <-- Remove controls
        }
        
        console.log("Orbit navigation disabled");                            // <-- Log deactivation
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Current Camera for External Use
    // ---------------------------------------------------------------
    function getCamera() {
        return orbitCamera;                                                  // <-- Return camera reference
    }
    // ---------------------------------------------------------------

    // FUNCTION | Reset Camera to Default Position
    // ---------------------------------------------------------------
    function reset() {
        resetCameraView();                                                   // <-- Call reset function
        console.log("Orbit camera reset to default view");                   // <-- Log reset
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Camera Target Position
    // ---------------------------------------------------------------
    function setTarget(targetVector) {
        if (!orbitCamera || !targetVector) return;                          // <-- Validate inputs
        
        orbitCamera.setTarget(targetVector);                                 // <-- Set new target
        defaultTarget = targetVector.clone();                                // <-- Update default target
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Camera Position
    // ---------------------------------------------------------------
    function setPosition(positionVector) {
        if (!orbitCamera || !positionVector) return;                        // <-- Validate inputs
        
        orbitCamera.setPosition(positionVector);                             // <-- Set new position
        defaultPosition = positionVector.clone();                            // <-- Update default position
    }
    // ---------------------------------------------------------------

    // FUNCTION | Clean Up Resources
    // ---------------------------------------------------------------
    function dispose() {
        disable();                                                           // <-- Ensure disabled first
        
        // DISPOSE CAMERA
        if (orbitCamera) {
            orbitCamera.dispose();                                           // <-- Clean up camera
            orbitCamera = null;                                              // <-- Clear reference
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
    window.TrueVision3D.NavigationModes.OrbitNavigation = {
        initialize: initialize,                                              // <-- Initialization method
        enable: enable,                                                      // <-- Enable navigation mode
        disable: disable,                                                    // <-- Disable navigation mode
        getCamera: getCamera,                                                // <-- Get camera reference
        reset: reset,                                                        // <-- Reset camera view
        setTarget: setTarget,                                                // <-- Set camera target
        setPosition: setPosition,                                            // <-- Set camera position
        dispose: dispose,                                                    // <-- Cleanup method
        isEnabled: () => isEnabled                                           // <-- Check enabled state
    };

    // MARK MODULE AS LOADED
    if (window.TrueVision3D.ModuleDependencyManager) {
        window.TrueVision3D.ModuleDependencyManager.markModuleLoaded('OrbitNavigation');
    }

// endregion -------------------------------------------------------------------

})();
