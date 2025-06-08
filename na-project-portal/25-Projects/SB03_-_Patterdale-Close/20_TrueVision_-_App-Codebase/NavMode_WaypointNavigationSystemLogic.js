// =============================================================================
// TRUEVISION - WAYPOINT NAVIGATION SYSTEM LOGIC
// =============================================================================
//
// FILE       : NavMode_WaypointNavigationSystemLogic.js
// NAMESPACE  : TrueVision3D.NavigationModes
// MODULE     : WaypointNavigation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Waypoint-based navigation system for architectural visualization
// CREATED    : 2025
//
// DESCRIPTION:
// - Implements a waypoint navigation system using predefined camera positions
// - Loads camera positions and metadata from Data_-_CameraAgentData.json
// - Provides 360-degree photo sphere viewing at each waypoint
// - Supports mouse/touch drag and optional accelerometer controls
// - Designed for users who struggle with traditional 3D navigation
// - Allows curated architectural tours with fixed viewing positions
//
// INTEGRATION WITH UI MENU SYSTEM:
// - This module provides the camera and navigation logic for waypoint mode
// - The UiMenu_NavModeButtonManager.js handles the toolbar button for this mode
// - When enabled via the UI button, this module takes control of the camera
// - The UI manager coordinates switching between this and other navigation modes
// - This module creates its own UI controls (prev/next, dropdown) when active
// - Button visibility and mode switching is managed externally by ApplicationCore
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Jan-2025 - Version 1.0.0
// - Initial implementation of waypoint navigation system
// - Added support for CameraAgentData.json loading and parsing
// - Implemented 360-degree rotation at waypoints
// - Added next/previous waypoint navigation controls
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

    // MODULE CONSTANTS | Navigation System Configuration
    // ------------------------------------------------------------
    const ROTATION_SPEED_MOUSE         = 0.005;                             // <-- Mouse rotation sensitivity
    const ROTATION_SPEED_TOUCH         = 0.01;                              // <-- Touch rotation sensitivity
    const ROTATION_SPEED_ACCELEROMETER = 0.02;                              // <-- Accelerometer rotation sensitivity
    const TRANSITION_DURATION          = 2000;                              // <-- Waypoint transition duration in ms
    const VERTICAL_ROTATION_LIMIT      = Math.PI / 2 - 0.1;                 // <-- Max up/down rotation (prevent gimbal lock)
    const MIN_FIELD_OF_VIEW            = 30;                                // <-- Minimum FOV in degrees
    const MAX_FIELD_OF_VIEW            = 110;                               // <-- Maximum FOV in degrees
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Variables and State Management
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Core Navigation State
    // ------------------------------------------------------------
    let scene                          = null;                              // <-- Babylon.js scene reference
    let canvas                         = null;                              // <-- HTML canvas element
    let waypointCamera                 = null;                              // <-- Universal camera for waypoint viewing
    let cameraAgentData                = null;                              // <-- Loaded waypoint data
    let currentWaypointIndex           = 0;                                 // <-- Current waypoint position
    let isTransitioning                = false;                             // <-- Transition animation state
    let isEnabled                      = false;                             // <-- Navigation mode enabled state
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Input Handling State
    // ------------------------------------------------------------
    let isDragging                     = false;                             // <-- Mouse/touch drag state
    let lastPointerX                   = 0;                                 // <-- Last pointer X position
    let lastPointerY                   = 0;                                 // <-- Last pointer Y position
    let currentRotationX               = 0;                                 // <-- Current horizontal rotation
    let currentRotationY               = 0;                                 // <-- Current vertical rotation
    let accelerometerEnabled           = false;                             // <-- Accelerometer control state
    let baseDeviceOrientation          = null;                              // <-- Initial device orientation
    let inputHandlersInitialized       = false;                             // <-- Track if handlers are attached
    let contextMenuHandler             = (e) => e.preventDefault();         // <-- Store context menu handler
    let touchStartHandler              = (e) => e.preventDefault();         // <-- Store touch start handler
    // ---------------------------------------------------------------

    // MODULE VARIABLES | UI Element References
    // ------------------------------------------------------------
    let waypointContainer              = null;                              // <-- Main UI container
    let waypointInfo                   = null;                              // <-- Waypoint info display container
    let waypointNameDisplay            = null;                              // <-- Waypoint name display element
    let waypointNumberDisplay          = null;                              // <-- Waypoint number display element
    let prevButton                     = null;                              // <-- Previous waypoint button
    let nextButton                     = null;                              // <-- Next waypoint button
    let accelerometerButton            = null;                              // <-- Accelerometer toggle button
    let waypointDropdown               = null;                              // <-- Waypoint dropdown element
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Waypoint Data Loading and Processing
// -----------------------------------------------------------------------------

    // FUNCTION | Load Camera Agent Data from JSON File
    // ------------------------------------------------------------
    async function loadCameraAgentData() {
        try {
            // DETERMINE DATA FILE PATH FROM CONFIGURATION
            const appConfig = window.TrueVision3D?.AppConfig;                // <-- Get app configuration
            let dataFilePath = 'Data_-_CameraAgentData.json';                // <-- Default data file path
            
            if (appConfig?.AppConfig_NavMode?.AppNavMode_Waypoint) {
                const waypointConfig = appConfig.AppConfig_NavMode.AppNavMode_Waypoint;
                dataFilePath = waypointConfig.NavMode_WaypointDataFileURL || 
                              waypointConfig.NavMode_WaypointDataFile || 
                              dataFilePath;                                   // <-- Use configured path if available
            }
            
            // LOAD JSON DATA FILE
            const response = await fetch(dataFilePath);                      // <-- Fetch data file
            if (!response.ok) {
                throw new Error(`Failed to load camera data: ${response.status}`); // <-- Handle HTTP errors
            }
            
            const data = await response.json();                              // <-- Parse JSON data
            
            // VALIDATE DATA STRUCTURE
            if (!data.cameraAgents || !Array.isArray(data.cameraAgents) || data.cameraAgents.length === 0) {
                throw new Error('Invalid camera agent data structure');      // <-- Validate required fields
            }
            
            // SORT WAYPOINTS BY NUMBER
            data.cameraAgents.sort((a, b) => a.waypointNumber - b.waypointNumber); // <-- Ensure correct order
            
            cameraAgentData = data;                                          // <-- Store loaded data
            console.log(`Loaded ${data.cameraAgents.length} waypoints`);     // <-- Log success
            
            return true;                                                     // <-- Return success status
            
        } catch (error) {
            console.error('Error loading camera agent data:', error);        // <-- Log error details
            return false;                                                    // <-- Return failure status
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Convert Camera Data to Babylon.js Coordinates
    // ---------------------------------------------------------------
    function convertCameraDataToBabylon(agentData) {
        // CONVERT POSITION (Y and Z are swapped in Babylon.js, X is inverted)
        // Also convert from millimeters to meters (divide by 1000)
        const position = new BABYLON.Vector3(
            -agentData.position.x / 1000,                                    // <-- X inverted and in meters (from mm)
            agentData.position.z / 1000,                                     // <-- Z becomes Y in meters
            -agentData.position.y / 1000                                     // <-- Y becomes -Z in meters
        );
        
        // CALCULATE ROTATION FROM DIRECTION VECTOR (X direction also inverted)
        const direction = new BABYLON.Vector3(
            -agentData.direction.x,                                          // <-- X direction component inverted
            agentData.direction.z,                                           // <-- Z becomes Y
            -agentData.direction.y                                           // <-- Y becomes -Z
        );
        
        // CALCULATE FIELD OF VIEW FROM LENS MM
        const fov = calculateFieldOfView(agentData.camera.lensMm, agentData.camera.aspectRatio); // <-- Convert lens to FOV
        
        return {
            position: position,                                              // <-- Camera position
            direction: direction,                                            // <-- Look direction
            fov: fov,                                                        // <-- Field of view
            metadata: agentData                                              // <-- Original data reference
        };
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Calculate Field of View from Lens MM
    // ---------------------------------------------------------------
    function calculateFieldOfView(lensMm, aspectRatioString) {
        // STANDARD 35MM SENSOR DIMENSIONS
        const sensorWidth = 36;                                              // <-- 35mm sensor width
        const aspectRatio = parseAspectRatio(aspectRatioString);             // <-- Parse aspect ratio
        const sensorHeight = sensorWidth / aspectRatio;                      // <-- Calculate sensor height
        
        // CALCULATE DIAGONAL FOV
        const sensorDiagonal = Math.sqrt(sensorWidth * sensorWidth + sensorHeight * sensorHeight); // <-- Sensor diagonal
        const fovRadians = 2 * Math.atan(sensorDiagonal / (2 * lensMm));    // <-- FOV in radians
        const fovDegrees = fovRadians * (180 / Math.PI);                    // <-- Convert to degrees
        
        // CLAMP TO REASONABLE RANGE
        return Math.max(MIN_FIELD_OF_VIEW, Math.min(MAX_FIELD_OF_VIEW, fovDegrees)); // <-- Apply limits
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Parse Aspect Ratio String to Number
    // ---------------------------------------------------------------
    function parseAspectRatio(aspectRatioString) {
        if (!aspectRatioString || typeof aspectRatioString !== 'string') {
            return 16 / 9;                                                   // <-- Default to 16:9
        }
        
        const parts = aspectRatioString.split(':');                          // <-- Split ratio string
        if (parts.length !== 2) {
            return 16 / 9;                                                   // <-- Default if invalid format
        }
        
        const width = parseFloat(parts[0]);                                  // <-- Parse width value
        const height = parseFloat(parts[1]);                                 // <-- Parse height value
        
        return (width && height && height > 0) ? width / height : 16 / 9;    // <-- Calculate ratio
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Camera Creation and Management
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Waypoint Camera System
    // ------------------------------------------------------------
    function initializeWaypointCamera() {
        if (!scene || !cameraAgentData) return;                              // <-- Validate prerequisites
        
        // CREATE UNIVERSAL CAMERA FOR 360-DEGREE VIEWING
        waypointCamera = new BABYLON.UniversalCamera("waypointCamera", 
            BABYLON.Vector3.Zero(), scene);                                  // <-- Create at origin
        
        // SET INITIAL TARGET TO LOOK FORWARD
        waypointCamera.setTarget(new BABYLON.Vector3(0, 0, 1));              // <-- Set default forward target
        
        // CONFIGURE CAMERA PROPERTIES
        waypointCamera.minZ = 0.1;                                           // <-- Near clipping plane
        waypointCamera.maxZ = 10000;                                         // <-- Far clipping plane
        waypointCamera.inertia = 0;                                          // <-- Disable inertia for precise control
        waypointCamera.speed = 0;                                            // <-- Disable keyboard movement
        
        // DISABLE DEFAULT CAMERA INPUTS
        waypointCamera.inputs.clear();                                       // <-- Remove all default inputs
        
        // LOAD FIRST WAYPOINT
        if (cameraAgentData.cameraAgents.length > 0) {
            navigateToWaypoint(0, false);                                    // <-- Go to first waypoint instantly
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Create Visual Waypoint Markers in Scene
    // ------------------------------------------------------------
    function createWaypointMarkers() {
        if (!scene || !cameraAgentData) return;                             // <-- Validate prerequisites
        
        // GET CONFIGURATION VALUES DIRECTLY FROM LOADED CONFIG
        const appConfig = window.TrueVision3D?.AppConfig?.AppConfig;         // <-- Get app configuration
        
        // LOAD WAYPOINT ORB CONFIGURATION WITH PROPER DEFAULTS
        const orbsEnabled = appConfig?.devMode_WaypointOrbsOn !== false;     // <-- Check if orbs should be shown
        const orbSizeMm = appConfig?.devMode_WaypointOrbsSize || 100;        // <-- Size in millimeters
        const orbColor = appConfig?.devMode_WaypointOrbsColor || "#cd0000";  // <-- Orb color
        const orbOpacity = appConfig?.devMode_WaypointOrbsOpacity || 0.5;    // <-- Orb opacity
        
        // CONVERT SIZE FROM MILLIMETERS TO METERS
        const orbDiameterM = orbSizeMm / 1000;                               // <-- Convert mm to meters for Babylon.js
        
        console.log("Waypoint markers config:", {
            enabled: orbsEnabled,
            sizeMm: orbSizeMm,
            diameterM: orbDiameterM,
            color: orbColor,
            opacity: orbOpacity
        });
        
        const waypoints = cameraAgentData.cameraAgents;                     // <-- Get waypoint array
        
        waypoints.forEach((waypoint, index) => {
            const markerData = convertCameraDataToBabylon(waypoint);         // <-- Convert coordinates
            
            // CREATE MARKER SPHERE WITH CONFIGURED SIZE
            const marker = BABYLON.MeshBuilder.CreateSphere(
                `waypointMarker_${index}`,                                   // <-- Unique marker name
                { diameter: orbDiameterM, segments: 32 },                    // <-- Use config size in meters
                scene
            );
            
            marker.position = markerData.position.clone();                   // <-- Set marker position
            
            // CREATE MATERIAL WITH CONFIGURED COLOR AND OPACITY
            const material = new BABYLON.StandardMaterial(`waypointMat_${index}`, scene);
            
            // PARSE COLOR FROM HEX STRING WITH ERROR HANDLING
            let color;
            try {
                color = BABYLON.Color3.FromHexString(orbColor);               // <-- Parse hex color
            } catch (error) {
                console.warn("Invalid hex color, using default red:", orbColor);
                color = new BABYLON.Color3(0.8, 0, 0);                       // <-- Fallback red
            }
            
            material.diffuseColor = color;                                    // <-- Apply color
            material.emissiveColor = color.scale(0.5);                       // <-- Add glow
            material.alpha = orbOpacity;                                      // <-- Set transparency
            material.specularColor = new BABYLON.Color3(1, 1, 1);            // <-- White highlights
            material.specularPower = 32;                                      // <-- Shiny surface
            marker.material = material;                                       // <-- Apply material
            
            // CREATE LABEL
            const label = BABYLON.MeshBuilder.CreatePlane(
                `waypointLabel_${index}`,                                    // <-- Label name
                { width: 3, height: 1.2 },                                   // <-- Label size
                scene
            );
            label.position = marker.position.clone();                        // <-- Position at marker
            label.position.y += 1.5;                                         // <-- Raise above marker
            label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;           // <-- Always face camera
            
            // CREATE LABEL TEXTURE
            const labelTexture = new BABYLON.DynamicTexture(
                `waypointLabelTex_${index}`,                                 // <-- Texture name
                { width: 512, height: 256 },                                 // <-- Higher resolution
                scene
            );
            const labelMaterial = new BABYLON.StandardMaterial(`waypointLabelMat_${index}`, scene);
            labelMaterial.diffuseTexture = labelTexture;                     // <-- Apply texture
            labelMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);       // <-- Full bright
            labelMaterial.backFaceCulling = false;                           // <-- Visible from both sides
            label.material = labelMaterial;                                  // <-- Apply material
            
            // DRAW TEXT ON TEXTURE
            const context = labelTexture.getContext();                       // <-- Get 2D context
            context.fillStyle = "black";                                     // <-- Black background
            context.fillRect(0, 0, 512, 256);                               // <-- Fill background
            context.font = "bold 72px Arial";                                // <-- Large font
            context.fillStyle = "white";                                     // <-- White text
            context.textAlign = "center";                                    // <-- Center text
            context.fillText(`${index + 1}`, 256, 100);                     // <-- Draw waypoint number
            context.font = "48px Arial";                                     // <-- Smaller font for name
            context.fillText(waypoint.agentName || `Waypoint ${index + 1}`, 256, 180); // <-- Draw name
            labelTexture.update();                                           // <-- Update texture
            
            // MAKE MARKER CLICKABLE
            marker.isPickable = true;                                        // <-- Enable picking
            marker.actionManager = new BABYLON.ActionManager(scene);         // <-- Create action manager
            marker.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPickTrigger,                     // <-- On click trigger
                    () => navigateToWaypoint(index, true)                   // <-- Navigate to waypoint
                )
            );
            
            // HOVER EFFECTS
            marker.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPointerOverTrigger,             // <-- Mouse over
                    () => {
                        material.diffuseColor = color.scale(1.3);             // <-- Brighter red on hover
                        material.emissiveColor = color.scale(0.8);            // <-- Stronger glow
                        canvas.style.cursor = 'pointer';                     // <-- Change cursor
                    }
                )
            );
            
            marker.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                    BABYLON.ActionManager.OnPointerOutTrigger,              // <-- Mouse out
                    () => {
                        material.diffuseColor = color;                        // <-- Reset to configured color
                        material.emissiveColor = color.scale(0.5);            // <-- Reset glow
                        canvas.style.cursor = 'grab';                        // <-- Reset cursor
                    }
                )
            );
            
            // STORE REFERENCES
            waypoint.marker = marker;                                        // <-- Store marker reference
            waypoint.label = label;                                          // <-- Store label reference
            
            // SET INITIAL VISIBILITY BASED ON CONFIGURATION
            marker.isVisible = orbsEnabled;                                  // <-- Apply config visibility
            label.isVisible = orbsEnabled;                                   // <-- Apply config visibility
        });
        
        console.log(`Created ${waypoints.length} waypoint markers - ${orbsEnabled ? 'visible' : 'hidden'}, ${orbSizeMm}mm diameter`);
    }
    // ---------------------------------------------------------------

    // FUNCTION | Update Orb Visibility and Properties from Configuration
    // ---------------------------------------------------------------
    function updateMarkersFromConfig() {
        if (!cameraAgentData) return;                                        // <-- Validate data exists
        
        const appConfig = window.TrueVision3D?.AppConfig?.AppConfig;         // <-- Get fresh config
        const orbsEnabled = appConfig?.devMode_WaypointOrbsOn !== false;     // <-- Get visibility state
        const orbSizeMm = appConfig?.devMode_WaypointOrbsSize || 100;        // <-- Get size in mm
        const orbColor = appConfig?.devMode_WaypointOrbsColor || "#cd0000";  // <-- Get color
        const orbOpacity = appConfig?.devMode_WaypointOrbsOpacity || 0.5;    // <-- Get opacity
        
        console.log("DevTools: Updating waypoint markers from config:", {
            enabled: orbsEnabled,
            sizeMm: orbSizeMm,
            color: orbColor,
            opacity: orbOpacity
        });
        
        // UPDATE EXISTING MARKERS
        cameraAgentData.cameraAgents.forEach((waypoint, index) => {
            if (waypoint.marker) {
                // UPDATE VISIBILITY
                waypoint.marker.isVisible = orbsEnabled;                     // <-- Apply visibility
                if (waypoint.label) waypoint.label.isVisible = orbsEnabled;  // <-- Apply label visibility
                
                // UPDATE SIZE IF NEEDED
                const currentSize = waypoint.marker.getBoundingInfo().boundingBox.maximum.x * 2;
                const newSizeM = orbSizeMm / 1000;                           // <-- Convert to meters
                
                if (Math.abs(currentSize - newSizeM) > 0.001) {              // <-- Check if size changed
                    waypoint.marker.scaling = new BABYLON.Vector3(
                        newSizeM / currentSize,
                        newSizeM / currentSize,
                        newSizeM / currentSize
                    );                                                       // <-- Scale marker to new size
                }
                
                // UPDATE MATERIAL COLOR AND OPACITY
                if (waypoint.marker.material) {
                    try {
                        const color = BABYLON.Color3.FromHexString(orbColor); // <-- Parse new color
                        waypoint.marker.material.diffuseColor = color;       // <-- Apply new color
                        waypoint.marker.material.emissiveColor = color.scale(orbOpacity * 0.3); // <-- Update glow
                        waypoint.marker.material.alpha = orbOpacity;         // <-- Update transparency
                    } catch (error) {
                        console.warn("Invalid color format:", orbColor);     // <-- Log color error
                    }
                }
            }
        });
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Navigate to Specific Waypoint
    // ---------------------------------------------------------------
    function navigateToWaypoint(index, animate = true) {
        if (!cameraAgentData || !waypointCamera) return;                    // <-- Validate prerequisites
        
        const waypoints = cameraAgentData.cameraAgents;                     // <-- Get waypoint array
        if (index < 0 || index >= waypoints.length) return;                 // <-- Validate index bounds
        
        const targetWaypoint = waypoints[index];                             // <-- Get target waypoint data
        const cameraData = convertCameraDataToBabylon(targetWaypoint);       // <-- Convert to Babylon coordinates
        
        // RESET ROTATION VALUES BEFORE TRANSITION
        currentRotationX = 0;                                                // <-- Reset horizontal rotation
        currentRotationY = 0;                                                // <-- Reset vertical rotation
        
        if (animate && !isTransitioning) {
            // ANIMATE TRANSITION TO NEW WAYPOINT
            animateCameraTransition(cameraData, () => {
                currentWaypointIndex = index;                                // <-- Update current index
                updateWaypointUI();                                          // <-- Update UI display
                
                // SET CAMERA TARGET BASED ON DIRECTION
                const lookAtTarget = cameraData.position.add(cameraData.direction.scale(10)); // <-- Calculate target point
                waypointCamera.setTarget(lookAtTarget);                     // <-- Set camera to look at target
            });
        } else {
            // INSTANT TRANSITION
            waypointCamera.position = cameraData.position.clone();           // <-- Set position immediately
            waypointCamera.fov = cameraData.fov * (Math.PI / 180);          // <-- Set field of view
            
            // SET CAMERA TARGET BASED ON DIRECTION
            const lookAtTarget = cameraData.position.add(cameraData.direction.scale(10)); // <-- Calculate target point
            waypointCamera.setTarget(lookAtTarget);                         // <-- Set camera to look at target
            
            currentWaypointIndex = index;                                    // <-- Update current index
            updateWaypointUI();                                              // <-- Update UI display
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Animate Camera Transition Between Waypoints
    // ---------------------------------------------------------------
    function animateCameraTransition(targetData, onComplete) {
        isTransitioning = true;                                              // <-- Set transition flag
        
        const startPosition = waypointCamera.position.clone();               // <-- Store start position
        const startFov = waypointCamera.fov;                                 // <-- Store start FOV
        const targetFov = targetData.fov * (Math.PI / 180);                  // <-- Convert target FOV to radians
        
        let startTime = null;                                                // <-- Animation start time
        
        // ANIMATION LOOP FUNCTION
        function animate(currentTime) {
            if (!startTime) startTime = currentTime;                         // <-- Initialize start time
            
            const elapsed = currentTime - startTime;                         // <-- Calculate elapsed time
            const progress = Math.min(elapsed / TRANSITION_DURATION, 1);     // <-- Calculate progress (0-1)
            
            // EASE-IN-OUT CUBIC FUNCTION
            const eased = progress < 0.5 
                ? 4 * progress * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;                   // <-- Smooth easing curve
            
            // INTERPOLATE POSITION
            waypointCamera.position = BABYLON.Vector3.Lerp(
                startPosition, 
                targetData.position, 
                eased
            );                                                               // <-- Smooth position transition
            
            // INTERPOLATE FIELD OF VIEW
            waypointCamera.fov = startFov + (targetFov - startFov) * eased;  // <-- Smooth FOV transition
            
            if (progress < 1) {
                requestAnimationFrame(animate);                              // <-- Continue animation
            } else {
                isTransitioning = false;                                     // <-- Clear transition flag
                if (onComplete) onComplete();                                // <-- Call completion callback
            }
        }
        
        requestAnimationFrame(animate);                                      // <-- Start animation
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Reset Camera Rotation to Default
    // ---------------------------------------------------------------
    function resetRotation() {
        currentRotationX = 0;                                                // <-- Reset horizontal rotation
        currentRotationY = 0;                                                // <-- Reset vertical rotation
        
        // RESTORE ORIGINAL WAYPOINT VIEW DIRECTION
        if (cameraAgentData && waypointCamera && currentWaypointIndex >= 0) {
            const currentWaypoint = cameraAgentData.cameraAgents[currentWaypointIndex];
            const cameraData = convertCameraDataToBabylon(currentWaypoint);
            const lookAtTarget = cameraData.position.add(cameraData.direction.scale(10));
            waypointCamera.setTarget(lookAtTarget);                         // <-- Reset to original target
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Update Camera Rotation Based on Current Values
    // ---------------------------------------------------------------
    function updateCameraRotation() {
        if (!waypointCamera) return;                                         // <-- Validate camera exists
        
        // PRESERVE ORIGINAL FOV FROM WAYPOINT DATA
        if (cameraAgentData && currentWaypointIndex >= 0) {
            const currentWaypoint = cameraAgentData.cameraAgents[currentWaypointIndex];
            const cameraData = convertCameraDataToBabylon(currentWaypoint);
            const correctFov = cameraData.fov * (Math.PI / 180);            // <-- Get correct FOV
            if (Math.abs(waypointCamera.fov - correctFov) > 0.001) {
                waypointCamera.fov = correctFov;                             // <-- Restore correct FOV
            }
        }
        
        // CLAMP VERTICAL ROTATION TO PREVENT GIMBAL LOCK
        currentRotationY = Math.max(-VERTICAL_ROTATION_LIMIT, 
                                   Math.min(VERTICAL_ROTATION_LIMIT, currentRotationY)); // <-- Apply limits
        
        // GET CURRENT WAYPOINT DATA FOR BASE DIRECTION
        if (cameraAgentData && currentWaypointIndex >= 0) {
            const currentWaypoint = cameraAgentData.cameraAgents[currentWaypointIndex];
            const cameraData = convertCameraDataToBabylon(currentWaypoint);
            
            // CALCULATE NEW TARGET BASED ON ROTATION OFFSETS
            const baseDirection = cameraData.direction.normalize();          // <-- Get normalized base direction
            
            // CREATE ROTATION MATRIX FOR YAW (Y-axis rotation)
            const yawMatrix = BABYLON.Matrix.RotationY(currentRotationX);    // <-- Yaw rotation matrix
            
            // CREATE ROTATION MATRIX FOR PITCH (X-axis rotation)
            let pitchAxis = BABYLON.Vector3.Cross(baseDirection, BABYLON.Vector3.Up()); // <-- Right vector
            
            // HANDLE EDGE CASE WHERE BASE DIRECTION IS VERTICAL
            if (pitchAxis.length() < 0.001) {                               // <-- Check for near-zero vector
                pitchAxis = BABYLON.Vector3.Right();                        // <-- Use default right vector
            } else {
                pitchAxis.normalize();                                       // <-- Normalize pitch axis
            }
            
            const pitchMatrix = BABYLON.Matrix.RotationAxis(pitchAxis, currentRotationY); // <-- Pitch rotation matrix
            
            // APPLY ROTATIONS TO BASE DIRECTION
            let rotatedDirection = BABYLON.Vector3.TransformNormal(baseDirection, yawMatrix);
            rotatedDirection = BABYLON.Vector3.TransformNormal(rotatedDirection, pitchMatrix);
            
            // SET NEW CAMERA TARGET
            const newTarget = waypointCamera.position.add(rotatedDirection.scale(10)); // <-- Calculate new target
            waypointCamera.setTarget(newTarget);                            // <-- Apply new target
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | User Input Handling - Mouse and Touch Controls
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Input Event Handlers
    // ---------------------------------------------------------------
    function initializeInputHandlers() {
        if (inputHandlersInitialized) return;                               // <-- Prevent duplicate handlers
        
        // MOUSE INPUT HANDLERS
        canvas.addEventListener("pointerdown", handlePointerDown, false);    // <-- Mouse/touch down handler
        canvas.addEventListener("pointermove", handlePointerMove, false);    // <-- Mouse/touch move handler
        canvas.addEventListener("pointerup", handlePointerUp, false);        // <-- Mouse/touch up handler
        canvas.addEventListener("wheel", handleWheel, false);                // <-- Mouse wheel handler
        
        // TOUCH INPUT HANDLERS WITH PASSIVE OPTION
        canvas.addEventListener("touchstart", handleTouchStart, { passive: false }); // <-- Touch start with explicit passive
        canvas.addEventListener("touchmove", handleTouchMove, { passive: false });   // <-- Touch move with explicit passive
        canvas.addEventListener("touchend", handleTouchEnd, false);          // <-- Touch end handler
        
        // PREVENT CONTEXT MENU ON RIGHT CLICK
        canvas.addEventListener("contextmenu", contextMenuHandler, false);   // <-- Disable context menu
        
        inputHandlersInitialized = true;                                     // <-- Mark handlers as initialized
        console.log("Input event handlers initialized");                     // <-- Log handler setup
    }
    // ---------------------------------------------------------------

    // FUNCTION | Remove Input Event Handlers
    // ---------------------------------------------------------------
    function removeInputHandlers() {
        if (!canvas || !inputHandlersInitialized) return;                   // <-- Validate prerequisites
        
        console.log("Removing waypoint input handlers");                     // <-- Debug log
        
        canvas.removeEventListener('mousedown', handlePointerDown, false);    // <-- Remove mouse down (bubble)
        canvas.removeEventListener('mousemove', handlePointerMove, false);    // <-- Remove mouse move (bubble)
        canvas.removeEventListener('mouseup', handlePointerUp, false);        // <-- Remove mouse up (bubble)
        canvas.removeEventListener('mouseleave', handlePointerUp, false);     // <-- Remove mouse leave (bubble)
        canvas.removeEventListener('touchstart', handleTouchStart, false);    // <-- Remove touch start (bubble)
        canvas.removeEventListener('touchmove', handleTouchMove, false);      // <-- Remove touch move (bubble)
        canvas.removeEventListener('touchend', handleTouchEnd, false);        // <-- Remove touch end (bubble)
        canvas.removeEventListener('wheel', handleWheel, false);              // <-- Remove wheel (bubble)
        canvas.removeEventListener('contextmenu', contextMenuHandler);       // <-- Remove context menu handler
        canvas.removeEventListener('touchstart', touchStartHandler, { passive: false }); // <-- Remove touch preventDefault
        
        inputHandlersInitialized = false;                                    // <-- Clear initialization flag
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Pointer Down Event (Mouse)
    // ---------------------------------------------------------------
    function handlePointerDown(event) {
        if (!isEnabled || isTransitioning) return;                          // <-- Check if interaction allowed
        
        // ONLY HANDLE EVENTS ON THE CANVAS, NOT UI ELEMENTS
        if (event.target !== canvas) {
            return;                                                          // <-- Let UI handle the event
        }
        
        // CHECK FOR LEFT MOUSE BUTTON (0) OR MIDDLE MOUSE BUTTON (1)
        if (event.button === 0 || event.button === 1) {                     // <-- Left or middle button
            event.preventDefault();                                          // <-- Prevent default behavior
            isDragging = true;                                               // <-- Set dragging state
            lastPointerX = event.clientX;                                    // <-- Store initial X position
            lastPointerY = event.clientY;                                    // <-- Store initial Y position
            
            canvas.style.cursor = 'grabbing';                                // <-- Change cursor style
            // console.log("Mouse drag started at waypoint", currentWaypointIndex); // <-- Debug log
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Pointer Move Event (Mouse)
    // ---------------------------------------------------------------
    function handlePointerMove(event) {
        if (!isDragging || !isEnabled || isTransitioning) return;           // <-- Check if dragging active
        
        event.preventDefault();                                              // <-- Prevent default behavior
        
        const deltaX = event.clientX - lastPointerX;                         // <-- Calculate X movement
        const deltaY = event.clientY - lastPointerY;                         // <-- Calculate Y movement
        
        // UPDATE ROTATION BASED ON MOUSE MOVEMENT
        currentRotationX += deltaX * ROTATION_SPEED_MOUSE;                   // <-- Apply horizontal rotation
        currentRotationY += deltaY * ROTATION_SPEED_MOUSE;                   // <-- Apply vertical rotation
        
        updateCameraRotation();                                              // <-- Apply rotation changes
        
        lastPointerX = event.clientX;                                        // <-- Update last X position
        lastPointerY = event.clientY;                                        // <-- Update last Y position
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Pointer Up Event (Mouse)
    // ---------------------------------------------------------------
    function handlePointerUp(event) {
        if (isDragging) {
            event.preventDefault();                                          // <-- Prevent default behavior
        }
        isDragging = false;                                                  // <-- Clear dragging state
        canvas.style.cursor = 'grab';                                        // <-- Reset cursor style
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Touch Start Event
    // ---------------------------------------------------------------
    function handleTouchStart(event) {
        if (!isEnabled || isTransitioning) return;                          // <-- Check if interaction allowed
        
        if (event.touches.length === 1) {                                    // <-- Single touch only
            isDragging = true;                                               // <-- Set dragging state
            lastPointerX = event.touches[0].clientX;                         // <-- Store initial X position
            lastPointerY = event.touches[0].clientY;                         // <-- Store initial Y position
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Touch Move Event
    // ---------------------------------------------------------------
    function handleTouchMove(event) {
        if (!isDragging || !isEnabled || isTransitioning) return;           // <-- Check if dragging active
        
        if (event.touches.length === 1) {                                    // <-- Single touch only
            const deltaX = event.touches[0].clientX - lastPointerX;          // <-- Calculate X movement
            const deltaY = event.touches[0].clientY - lastPointerY;          // <-- Calculate Y movement
            
            // UPDATE ROTATION BASED ON TOUCH MOVEMENT
            currentRotationX += deltaX * ROTATION_SPEED_TOUCH;               // <-- Apply horizontal rotation
            currentRotationY += deltaY * ROTATION_SPEED_TOUCH;               // <-- Apply vertical rotation
            
            updateCameraRotation();                                          // <-- Apply rotation changes
            
            lastPointerX = event.touches[0].clientX;                         // <-- Update last X position
            lastPointerY = event.touches[0].clientY;                         // <-- Update last Y position
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Touch End Event
    // ---------------------------------------------------------------
    function handleTouchEnd(event) {
        if (event.touches.length === 0) {                                    // <-- All touches ended
            isDragging = false;                                              // <-- Clear dragging state
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Mouse Wheel - Disabled for Fixed FOV
    // ---------------------------------------------------------------
    function handleWheel(event) {
        if (!isEnabled || isTransitioning || !waypointCamera) return;       // <-- Check if active
        
        event.preventDefault();                                              // <-- Prevent page scroll
        
        // FOV ZOOM DISABLED - Field of view is fixed based on JSON configuration
        // The FOV should remain as set by the waypoint data from SketchUp
        // No user adjustment is allowed
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Accelerometer Support for Mobile Devices
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Accelerometer Controls
    // ------------------------------------------------------------
    function initializeAccelerometer() {
        if (!window.DeviceOrientationEvent) {
            console.log("Device orientation not supported");                 // <-- Log lack of support
            if (accelerometerButton) {
                accelerometerButton.style.display = 'none';                  // <-- Hide button if not supported
            }
            return;
        }
        
        // REQUEST PERMISSION FOR IOS 13+
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            accelerometerButton.addEventListener('click', async () => {
                try {
                    const permission = await DeviceOrientationEvent.requestPermission(); // <-- Request permission
                    if (permission === 'granted') {
                        toggleAccelerometer();                               // <-- Enable if granted
                    }
                } catch (error) {
                    console.error('Permission request failed:', error);      // <-- Log permission error
                }
            });
        } else {
            // DIRECT TOGGLE FOR NON-IOS DEVICES
            if (accelerometerButton) {
                accelerometerButton.addEventListener('click', toggleAccelerometer); // <-- Direct toggle
            }
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Toggle Accelerometer Control On/Off
    // ---------------------------------------------------------------
    function toggleAccelerometer() {
        accelerometerEnabled = !accelerometerEnabled;                        // <-- Toggle state
        
        if (accelerometerEnabled) {
            baseDeviceOrientation = null;                                    // <-- Reset base orientation
            window.addEventListener('deviceorientation', handleDeviceOrientation); // <-- Start listening
            if (accelerometerButton) {
                accelerometerButton.textContent = 'Gyro: ON';               // <-- Update button text
                accelerometerButton.classList.add('active');                 // <-- Add active class
            }
        } else {
            window.removeEventListener('deviceorientation', handleDeviceOrientation); // <-- Stop listening
            if (accelerometerButton) {
                accelerometerButton.textContent = 'Gyro: OFF';              // <-- Update button text
                accelerometerButton.classList.remove('active');              // <-- Remove active class
            }
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Device Orientation Changes
    // ---------------------------------------------------------------
    function handleDeviceOrientation(event) {
        if (!accelerometerEnabled || !isEnabled || isTransitioning) return; // <-- Check if processing allowed
        
        // CAPTURE BASE ORIENTATION ON FIRST EVENT
        if (!baseDeviceOrientation) {
            baseDeviceOrientation = {
                alpha: event.alpha || 0,                                     // <-- Base compass direction
                beta: event.beta || 0,                                       // <-- Base front-back tilt
                gamma: event.gamma || 0                                      // <-- Base left-right tilt
            };
            return;
        }
        
        // CALCULATE RELATIVE ORIENTATION CHANGE
        const deltaAlpha = (event.alpha - baseDeviceOrientation.alpha) || 0; // <-- Compass change
        const deltaBeta = (event.beta - baseDeviceOrientation.beta) || 0;    // <-- Tilt change
        const deltaGamma = (event.gamma - baseDeviceOrientation.gamma) || 0; // <-- Roll change
        
        // APPLY ORIENTATION TO CAMERA ROTATION
        currentRotationX = deltaAlpha * ROTATION_SPEED_ACCELEROMETER * (Math.PI / 180); // <-- Convert to radians
        currentRotationY = deltaBeta * ROTATION_SPEED_ACCELEROMETER * (Math.PI / 180);  // <-- Convert to radians
        
        updateCameraRotation();                                              // <-- Apply rotation changes
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | User Interface Creation and Management
// -----------------------------------------------------------------------------

    // FUNCTION | Create Waypoint Navigation UI Elements
    // ------------------------------------------------------------
    function createWaypointUI() {
        // CREATE WAYPOINT NAVIGATION SECTION IN TOOLBAR
        const toolbar = document.getElementById('toolbar');                  // <-- Get toolbar element
        if (!toolbar) {
            console.error("Toolbar element not found");                      // <-- Log error
            return;
        }
        
        // CREATE CONTAINER FOR WAYPOINT CONTROLS
        waypointContainer = document.createElement('div');                   // <-- Create container element
        waypointContainer.id = 'waypoint-navigation-controls';               // <-- Set element ID
        waypointContainer.style.cssText = `
            display: none;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid #555041;
        `;                                                                   // <-- Apply styles
        
        // CREATE SECTION TITLE
        const sectionTitle = document.createElement('label');                // <-- Create title element
        sectionTitle.textContent = 'Waypoint Navigation';                    // <-- Set title text
        sectionTitle.style.cssText = `
            display: block;
            margin-bottom: 10px;
            font-weight: bold;
            color: #555041;
        `;                                                                   // <-- Apply title styles
        waypointContainer.appendChild(sectionTitle);                         // <-- Add title to container
        
        // CREATE WAYPOINT INFO DISPLAY
        waypointInfo = document.createElement('div');                        // <-- Create info element
        waypointInfo.style.cssText = `
            background: #f0f0f0;
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 3px;
            text-align: center;
        `;                                                                   // <-- Apply info styles
        
        // CREATE WAYPOINT NUMBER DISPLAY
        waypointNumberDisplay = document.createElement('div');               // <-- Create number display
        waypointNumberDisplay.style.cssText = `
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
        `;                                                                   // <-- Apply number styles
        
        // CREATE WAYPOINT NAME DISPLAY
        waypointNameDisplay = document.createElement('div');                 // <-- Create name display
        waypointNameDisplay.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            color: #333;
        `;                                                                   // <-- Apply name styles
        
        // ASSEMBLE INFO DISPLAY
        waypointInfo.appendChild(waypointNumberDisplay);                     // <-- Add number display
        waypointInfo.appendChild(waypointNameDisplay);                       // <-- Add name display
        waypointContainer.appendChild(waypointInfo);                         // <-- Add info to container
        
        // CREATE NAVIGATION BUTTONS CONTAINER
        const navButtonsContainer = document.createElement('div');           // <-- Create buttons container
        navButtonsContainer.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
        `;                                                                   // <-- Apply container styles
        
        // CREATE PREVIOUS BUTTON
        prevButton = createToolbarButton('❮ Prev', 'Previous waypoint');    // <-- Create prev button
        prevButton.addEventListener('click', navigateToPrevious);            // <-- Add click handler
        prevButton.style.flex = '1';                                         // <-- Equal width buttons
        
        // CREATE NEXT BUTTON
        nextButton = createToolbarButton('Next ❯', 'Next waypoint');        // <-- Create next button
        nextButton.addEventListener('click', navigateToNext);                // <-- Add click handler
        nextButton.style.flex = '1';                                         // <-- Equal width buttons
        
        // ADD BUTTONS TO CONTAINER
        navButtonsContainer.appendChild(prevButton);                         // <-- Add previous button
        navButtonsContainer.appendChild(nextButton);                         // <-- Add next button
        waypointContainer.appendChild(navButtonsContainer);                  // <-- Add buttons to main container
        
        // CREATE QUICK JUMP DROPDOWN
        const jumpContainer = document.createElement('div');                 // <-- Create jump container
        jumpContainer.style.cssText = `
            margin-top: 10px;
        `;                                                                   // <-- Apply container styles
        
        const jumpLabel = document.createElement('label');                   // <-- Create jump label
        jumpLabel.textContent = 'Quick Jump:';                               // <-- Set label text
        jumpLabel.style.cssText = `
            display: block;
            margin-bottom: 5px;
            font-size: 12px;
            color: #555041;
        `;                                                                   // <-- Apply label styles
        jumpContainer.appendChild(jumpLabel);                                // <-- Add label to container
        
        // CREATE WAYPOINT DROPDOWN
        waypointDropdown = document.createElement('select');                 // <-- Create dropdown element
        waypointDropdown.style.cssText = `
            width: 100%;
            padding: 5px;
            border: 1px solid #ccc;
            border-radius: 3px;
            background: white;
            cursor: pointer;
        `;                                                                   // <-- Apply dropdown styles
        waypointDropdown.addEventListener('change', (event) => {             // <-- Add change handler
            const selectedIndex = parseInt(event.target.value);              // <-- Get selected index
            if (!isNaN(selectedIndex)) {
                navigateToWaypoint(selectedIndex, true);                     // <-- Navigate to selected waypoint
            }
        });
        jumpContainer.appendChild(waypointDropdown);                         // <-- Add dropdown to container
        waypointContainer.appendChild(jumpContainer);                        // <-- Add jump section to main container
        
        // CREATE ACCELEROMETER BUTTON (MOBILE)
        accelerometerButton = createToolbarButton('Gyro: OFF', 'Toggle gyroscope'); // <-- Create gyro button
        accelerometerButton.style.cssText += `
            display: none;
            width: 100%;
            margin-top: 10px;
        `;                                                                   // <-- Apply button styles
        waypointContainer.appendChild(accelerometerButton);                  // <-- Add to container
        
        // ADD WAYPOINT CONTROLS TO TOOLBAR
        toolbar.appendChild(waypointContainer);                              // <-- Add to toolbar
        
        // POPULATE DROPDOWN WHEN DATA IS LOADED
        updateWaypointDropdown();                                            // <-- Initialize dropdown options
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Create Toolbar-Styled Button Element
    // ---------------------------------------------------------------
    function createToolbarButton(text, title) {
        const button = document.createElement('button');                     // <-- Create button element
        button.textContent = text;                                           // <-- Set button text
        button.title = title;                                                // <-- Set tooltip
        button.className = 'tool-button';                                    // <-- Apply toolbar button class
        button.style.cssText = `
            margin-bottom: 0;
        `;                                                                   // <-- Override margin
        
        return button;                                                       // <-- Return button element
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Update Waypoint Dropdown Options
    // ---------------------------------------------------------------
    function updateWaypointDropdown() {
        if (!waypointDropdown || !cameraAgentData) return;                  // <-- Validate prerequisites
        
        // CLEAR EXISTING OPTIONS
        waypointDropdown.innerHTML = '';                                     // <-- Clear dropdown
        
        // ADD WAYPOINT OPTIONS
        cameraAgentData.cameraAgents.forEach((waypoint, index) => {
            const option = document.createElement('option');                  // <-- Create option element
            option.value = index;                                            // <-- Set option value
            option.textContent = `${index + 1}: ${waypoint.agentName || `Waypoint ${index + 1}`}`; // <-- Set text
            waypointDropdown.appendChild(option);                            // <-- Add to dropdown
        });
        
        // SET CURRENT SELECTION
        waypointDropdown.value = currentWaypointIndex;                      // <-- Select current waypoint
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Update UI with Current Waypoint Information
    // ---------------------------------------------------------------
    function updateWaypointUI() {
        if (!cameraAgentData || !waypointNameDisplay || !waypointNumberDisplay) return; // <-- Validate elements
        
        const currentWaypoint = cameraAgentData.cameraAgents[currentWaypointIndex]; // <-- Get current waypoint
        const totalWaypoints = cameraAgentData.cameraAgents.length;          // <-- Get total count
        
        // UPDATE DISPLAY TEXT
        waypointNumberDisplay.textContent = `Waypoint ${currentWaypointIndex + 1} of ${totalWaypoints}`; // <-- Show position
        waypointNameDisplay.textContent = currentWaypoint.agentName || `Waypoint ${currentWaypointIndex + 1}`; // <-- Show name
        
        // UPDATE BUTTON STATES
        if (prevButton && nextButton) {
            prevButton.disabled = currentWaypointIndex === 0;                // <-- Disable at start
            nextButton.disabled = currentWaypointIndex === totalWaypoints - 1; // <-- Disable at end
            
            // UPDATE BUTTON STYLES
            prevButton.style.opacity = prevButton.disabled ? '0.5' : '1';    // <-- Visual feedback
            nextButton.style.opacity = nextButton.disabled ? '0.5' : '1';    // <-- Visual feedback
            prevButton.style.cursor = prevButton.disabled ? 'not-allowed' : 'pointer'; // <-- Cursor feedback
            nextButton.style.cursor = nextButton.disabled ? 'not-allowed' : 'pointer'; // <-- Cursor feedback
        }
        
        // UPDATE DROPDOWN SELECTION
        if (waypointDropdown) {
            waypointDropdown.value = currentWaypointIndex;                   // <-- Update dropdown selection
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Navigate to Previous Waypoint
    // ---------------------------------------------------------------
    function navigateToPrevious() {
        if (currentWaypointIndex > 0 && !isTransitioning) {                 // <-- Check if can go back
            navigateToWaypoint(currentWaypointIndex - 1, true);              // <-- Go to previous with animation
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Navigate to Next Waypoint
    // ---------------------------------------------------------------
    function navigateToNext() {
        if (currentWaypointIndex < cameraAgentData.cameraAgents.length - 1 && !isTransitioning) { // <-- Check if can go forward
            navigateToWaypoint(currentWaypointIndex + 1, true);              // <-- Go to next with animation
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Public API Methods
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Waypoint Navigation System
    // ------------------------------------------------------------
    async function initialize(babylonScene, targetCanvas) {
        scene = babylonScene;                                                // <-- Store scene reference
        canvas = targetCanvas;                                               // <-- Store canvas reference
        
        console.log("Initializing Waypoint Navigation System");              // <-- Log initialization start
        
        // CREATE UI CONTROLS FIRST
        createWaypointUI();                                                  // <-- Create UI controls
        
        // LOAD CAMERA AGENT DATA
        const dataLoaded = await loadCameraAgentData();                     // <-- Load waypoint data
        if (!dataLoaded) {
            console.error("Failed to load waypoint data");                   // <-- Log error
            return false;                                                    // <-- Return failure
        }
        
        initializeWaypointCamera();                                          // <-- Create waypoint camera
        createWaypointMarkers();                                             // <-- Create visual markers
        updateWaypointDropdown();                                            // <-- Populate dropdown with loaded data
        initializeInputHandlers();                                           // <-- Setup input handling
        initializeAccelerometer();                                           // <-- Setup accelerometer
        
        console.log("Waypoint Navigation System initialized successfully");  // <-- Log success
        return true;                                                         // <-- Return success
    }
    // ---------------------------------------------------------------

    // FUNCTION | Enable Waypoint Navigation Mode
    // ---------------------------------------------------------------
    function enable() {
        if (!waypointCamera || !scene) return;                              // <-- Validate prerequisites
        
        console.log("Enabling waypoint navigation mode");                    // <-- Debug log
        isEnabled = true;                                                    // <-- Set enabled flag
        
        // ACTIVATE WAYPOINT CAMERA
        scene.activeCamera = waypointCamera;                                 // <-- Set as active camera
        
        // RE-INITIALIZE INPUT HANDLERS IF NEEDED
        if (!inputHandlersInitialized) {
            initializeInputHandlers();                                       // <-- Re-attach event handlers
        }
        
        // SHOW UI CONTROLS IN SIDEBAR
        if (waypointContainer) {
            console.log("Showing waypoint controls container");              // <-- Debug log
            waypointContainer.style.display = 'block';                       // <-- Show navigation controls
            updateWaypointUI();                                              // <-- Update UI with current waypoint
            updateWaypointDropdown();                                         // <-- Update dropdown options
        } else {
            console.error("Waypoint container not found!");                  // <-- Debug error
        }
        
        // SET CANVAS CURSOR
        canvas.style.cursor = 'grab';                                        // <-- Set grab cursor
        
        // UPDATE MARKERS FROM CURRENT CONFIGURATION
        updateMarkersFromConfig();                                           // <-- Apply current config settings
        
        console.log("Waypoint navigation enabled");                          // <-- Log activation
    }
    // ---------------------------------------------------------------

    // FUNCTION | Disable Waypoint Navigation Mode
    // ---------------------------------------------------------------
    function disable() {
        isEnabled = false;                                                   // <-- Clear enabled flag
        
        // REMOVE INPUT HANDLERS TO PREVENT CONFLICTS
        removeInputHandlers();                                               // <-- Clean up event handlers
        
        // HIDE UI CONTROLS IN SIDEBAR
        if (waypointContainer) {
            waypointContainer.style.display = 'none';                        // <-- Hide navigation controls
        }
        
        // RESET CANVAS CURSOR
        canvas.style.cursor = 'default';                                     // <-- Reset cursor
        
        // DISABLE ACCELEROMETER IF ACTIVE
        if (accelerometerEnabled) {
            toggleAccelerometer();                                           // <-- Turn off accelerometer
        }
        
        // HIDE WAYPOINT MARKERS IN SCENE
        if (cameraAgentData) {
            cameraAgentData.cameraAgents.forEach(waypoint => {
                if (waypoint.marker) waypoint.marker.isVisible = false;      // <-- Hide marker
                if (waypoint.label) waypoint.label.isVisible = false;        // <-- Hide label
            });
        }
        
        console.log("Waypoint navigation disabled");                         // <-- Log deactivation
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Current Camera for External Use
    // ---------------------------------------------------------------
    function getCamera() {
        return waypointCamera;                                               // <-- Return camera reference
    }
    // ---------------------------------------------------------------

    // FUNCTION | Reset to First Waypoint
    // ---------------------------------------------------------------
    function reset() {
        if (!isEnabled || !cameraAgentData) return;                         // <-- Check if can reset
        
        navigateToWaypoint(0, true);                                         // <-- Go to first waypoint
        resetRotation();                                                     // <-- Reset view rotation
        
        console.log("Waypoint navigation reset");                            // <-- Log reset
    }
    // ---------------------------------------------------------------

    // FUNCTION | Clean Up Resources
    // ---------------------------------------------------------------
    function dispose() {
        disable();                                                           // <-- Ensure disabled first
        
        // REMOVE EVENT LISTENERS - MUST USE SAME CAPTURE FLAG AS WHEN ADDED
        if (canvas && inputHandlersInitialized) {
            canvas.removeEventListener('mousedown', handlePointerDown, false); // <-- Remove mouse down (bubble)
            canvas.removeEventListener('mousemove', handlePointerMove, false); // <-- Remove mouse move (bubble)
            canvas.removeEventListener('mouseup', handlePointerUp, false);     // <-- Remove mouse up (bubble)
            canvas.removeEventListener('mouseleave', handlePointerUp, false); // <-- Remove mouse leave (bubble)
            canvas.removeEventListener('touchstart', handleTouchStart, false); // <-- Remove touch start (bubble)
            canvas.removeEventListener('touchmove', handleTouchMove, false);  // <-- Remove touch move (bubble)
            canvas.removeEventListener('touchend', handleTouchEnd, false);    // <-- Remove touch end (bubble)
            canvas.removeEventListener('wheel', handleWheel, false);          // <-- Remove wheel (bubble)
            canvas.removeEventListener('contextmenu', contextMenuHandler);   // <-- Remove context menu handler
            canvas.removeEventListener('touchstart', touchStartHandler, { passive: false }); // <-- Remove touch preventDefault
            
            inputHandlersInitialized = false;                                // <-- Clear initialization flag
        }
        
        // REMOVE UI ELEMENTS
        if (waypointContainer && waypointContainer.parentNode) {
            waypointContainer.parentNode.removeChild(waypointContainer);     // <-- Remove from DOM
        }
        
        // DISPOSE CAMERA
        if (waypointCamera) {
            waypointCamera.dispose();                                        // <-- Clean up camera
            waypointCamera = null;                                           // <-- Clear reference
        }
        
        // CLEAR REFERENCES
        scene = null;                                                        // <-- Clear scene reference
        canvas = null;                                                       // <-- Clear canvas reference
        cameraAgentData = null;                                              // <-- Clear data reference
    }
    // ---------------------------------------------------------------

    // NEW FUNCTION | Update Orb Visibility (Called from external systems)
    // ---------------------------------------------------------------
    function updateOrbVisibility(visible) {
        if (cameraAgentData) {
            cameraAgentData.cameraAgents.forEach(waypoint => {
                if (waypoint.marker) waypoint.marker.isVisible = visible;    // <-- Update marker visibility
                if (waypoint.label) waypoint.label.isVisible = visible;      // <-- Update label visibility
            });
            console.log(`DevTools: Waypoint orbs ${visible ? 'shown' : 'hidden'} via external call`);
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Export
// -----------------------------------------------------------------------------

    // EXPORT PUBLIC API
    window.TrueVision3D.NavigationModes.WaypointNavigation = {
        initialize: initialize,                                              // <-- Initialization method
        enable: enable,                                                      // <-- Enable navigation mode
        disable: disable,                                                    // <-- Disable navigation mode
        getCamera: getCamera,                                                // <-- Get camera reference
        reset: reset,                                                        // <-- Reset to first waypoint
        dispose: dispose,                                                    // <-- Cleanup method
        updateOrbVisibility: updateOrbVisibility,                            // <-- NEW: Update orb visibility
        isEnabled: () => isEnabled                                           // <-- Check enabled state
    };

// endregion -------------------------------------------------------------------

})();










