// =============================================================================
// VALEDESIGNSUITE - DEBUG MARKERS MANAGER
// =============================================================================
//
// FILE       : DevTools_DebugMarkersManager.js
// NAMESPACE  : TrueVision3D.DevTools
// MODULE     : DebugMarkersManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Centralized management of all debug markers and development tools
// CREATED    : 2025
//
// DESCRIPTION:
// - Manages visibility of waypoint orbs based on configuration settings
// - Finds and controls camera agent markers imported from SketchUp models
// - Provides centralized control for all development debugging features
// - Uses Data_-_MainAppConfig.json as single source of truth for all settings
// - Integrates with existing navigation systems to apply debug visibility rules
// - Supports dynamic toggling of debug features without requiring app restart
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 2025 - Version 1.0.0
// - Initial Release
// - Waypoint orb visibility management
// - Camera agent marker detection and control
// - Configuration-driven debug feature management
//
// =============================================================================

// Ensure TrueVision3D namespace exists
window.TrueVision3D = window.TrueVision3D || {};
window.TrueVision3D.DevTools = window.TrueVision3D.DevTools || {};

(function() {
'use strict';

// -----------------------------------------------------------------------------
// REGION | DevTools Configuration and State Management
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Core System References
    // ------------------------------------------------------------
    let scene                          = null;                               // <-- Babylon.js scene reference
    let appConfig                      = null;                               // <-- Application configuration reference
    let initialized                    = false;                              // <-- Initialization state flag
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Camera Agent Marker Management
    // ------------------------------------------------------------
    let cameraAgentMeshes              = [];                                 // <-- Array of found camera agent meshes
    let cameraAgentPattern             = "Camera_Agent_CAM";                 // <-- Default search pattern
    let cameraAgentMarkersVisible      = true;                               // <-- Current visibility state
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Debug Feature State
    // ------------------------------------------------------------
    let waypointOrbsEnabled            = true;                               // <-- Waypoint orbs enabled state
    let debugMeshesEnabled             = false;                              // <-- Debug mesh info enabled state
    let meshBoundsEnabled              = false;                              // <-- Mesh bounds enabled state
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Debug UI Elements
    // ------------------------------------------------------------
    let debugPanel                     = null;                               // <-- Debug panel container
    let debugPanelVisible              = false;                              // <-- Debug panel visibility state
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Configuration Loading and Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Debug Markers Manager
    // ------------------------------------------------------------
    function initialize(babylonScene) {
        scene = babylonScene;                                                // <-- Store scene reference
        
        // LOAD CONFIGURATION
        appConfig = window.TrueVision3D?.AppConfig;                          // <-- Get app configuration
        if (!appConfig) {
            console.error("DevTools: App configuration not available");      // <-- Log error
            return false;
        }
        
        // LOAD CONFIGURATION VALUES
        loadConfigurationSettings();                                         // <-- Load dev mode settings
        
        // INITIALIZE CAMERA AGENT MARKER DETECTION
        initializeCameraAgentDetection();                                    // <-- Find camera agent markers
        
        // CREATE DEBUG PANEL IF DEV MODE ENABLED
        if (appConfig.AppConfig?.devMode_Enabled) {
            createDebugPanel();                                              // <-- Create debug UI
        }
        
        initialized = true;                                                   // <-- Mark as initialized
        console.log("DevTools: Debug Markers Manager initialized successfully"); // <-- Log success
        
        return true;                                                         // <-- Return success
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Load Configuration Settings from AppConfig
    // ---------------------------------------------------------------
    function loadConfigurationSettings() {
        const devConfig = appConfig.AppConfig;                               // <-- Get dev configuration section
        if (!devConfig) return;                                              // <-- Exit if no config
        
        // LOAD WAYPOINT ORB SETTINGS
        waypointOrbsEnabled = devConfig.devMode_WaypointOrbsOn !== false;    // <-- Default to true if not specified
        
        // LOAD CAMERA AGENT MARKER SETTINGS
        cameraAgentMarkersVisible = devConfig.devMode_CameraAgentMarkers !== false; // <-- Default to true
        cameraAgentPattern = devConfig.devMode_CameraAgentMarkersPattern || "Camera_Agent_CAM"; // <-- Load pattern
        
        // LOAD OTHER DEBUG SETTINGS
        debugMeshesEnabled = devConfig.devMode_DebugMeshes === true;         // <-- Default to false
        meshBoundsEnabled = devConfig.devMode_ShowMeshBounds === true;       // <-- Default to false
        
        console.log("DevTools: Configuration loaded", {
            waypointOrbs: waypointOrbsEnabled,
            cameraAgentMarkers: cameraAgentMarkersVisible,
            debugMeshes: debugMeshesEnabled,
            meshBounds: meshBoundsEnabled
        });
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Camera Agent Marker Detection and Management
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Camera Agent Marker Detection
    // ------------------------------------------------------------
    function initializeCameraAgentDetection() {
        if (!scene) return;                                                   // <-- Validate scene exists
        
        // SEARCH FOR CAMERA AGENT MESHES BY NAME PATTERN
        findCameraAgentMeshes();                                             // <-- Find all camera agent meshes
        
        // APPLY INITIAL VISIBILITY STATE
        setCameraAgentMarkersVisibility(cameraAgentMarkersVisible);          // <-- Apply config setting
        
        // WATCH FOR NEW MESHES BEING ADDED TO SCENE
        scene.onNewMeshAddedObservable.add((mesh) => {
            if (mesh.name && mesh.name.includes(cameraAgentPattern)) {
                cameraAgentMeshes.push(mesh);                                // <-- Add to tracked list
                mesh.isVisible = cameraAgentMarkersVisible;                  // <-- Apply current visibility
                console.log("DevTools: New camera agent mesh detected:", mesh.name); // <-- Log detection
            }
        });
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Find All Camera Agent Meshes in Scene
    // ---------------------------------------------------------------
    function findCameraAgentMeshes() {
        cameraAgentMeshes = [];                                              // <-- Reset array
        
        if (!scene || !scene.meshes) return;                                // <-- Validate scene and meshes
        
        // SEARCH THROUGH ALL MESHES FOR CAMERA AGENT PATTERN
        scene.meshes.forEach(mesh => {
            if (mesh.name && mesh.name.includes(cameraAgentPattern)) {
                cameraAgentMeshes.push(mesh);                                // <-- Add to tracked list
                console.log("DevTools: Found camera agent mesh:", mesh.name); // <-- Log found mesh
            }
        });
        
        console.log(`DevTools: Found ${cameraAgentMeshes.length} camera agent meshes`); // <-- Log total found
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Camera Agent Markers Visibility
    // ---------------------------------------------------------------
    function setCameraAgentMarkersVisibility(visible) {
        cameraAgentMarkersVisible = visible;                                 // <-- Update state
        
        // APPLY VISIBILITY TO ALL TRACKED MESHES
        cameraAgentMeshes.forEach(mesh => {
            if (mesh && !mesh.isDisposed()) {
                mesh.isVisible = visible;                                    // <-- Set mesh visibility
            }
        });
        
        console.log(`DevTools: Camera agent markers ${visible ? 'shown' : 'hidden'}`); // <-- Log action
    }
    // ---------------------------------------------------------------

    // FUNCTION | Toggle Camera Agent Markers Visibility
    // ---------------------------------------------------------------
    function toggleCameraAgentMarkers() {
        setCameraAgentMarkersVisibility(!cameraAgentMarkersVisible);         // <-- Toggle state
        return cameraAgentMarkersVisible;                                    // <-- Return new state
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Waypoint Orb Management Integration
// -----------------------------------------------------------------------------

    // FUNCTION | Check if Waypoint Orbs Should Be Visible
    // ------------------------------------------------------------
    function shouldShowWaypointOrbs() {
        if (!appConfig?.AppConfig?.devMode_Enabled) return false;            // <-- Return false if dev mode disabled
        return waypointOrbsEnabled;                                          // <-- Return configured state
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Waypoint Orbs Visibility State
    // ---------------------------------------------------------------
    function setWaypointOrbsVisibility(visible) {
        waypointOrbsEnabled = visible;                                       // <-- Update state
        
        // NOTIFY WAYPOINT NAVIGATION SYSTEM OF CHANGE
        const waypointNav = window.TrueVision3D?.NavigationModes?.WaypointNavigation;
        if (waypointNav && waypointNav.updateOrbVisibility) {
            waypointNav.updateOrbVisibility(visible);                        // <-- Update waypoint system
        }
        
        console.log(`DevTools: Waypoint orbs ${visible ? 'enabled' : 'disabled'}`); // <-- Log action
    }
    // ---------------------------------------------------------------

    // FUNCTION | Toggle Waypoint Orbs Visibility
    // ---------------------------------------------------------------
    function toggleWaypointOrbs() {
        setWaypointOrbsVisibility(!waypointOrbsEnabled);                     // <-- Toggle state
        return waypointOrbsEnabled;                                          // <-- Return new state
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Debug Panel User Interface
// -----------------------------------------------------------------------------

    // FUNCTION | Create Debug Panel UI
    // ------------------------------------------------------------
    function createDebugPanel() {
        // CREATE DEBUG PANEL CONTAINER
        debugPanel = document.createElement('div');                          // <-- Create panel container
        debugPanel.id = 'devtools-debug-panel';                              // <-- Set panel ID
        debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            width: 250px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 12px;
            z-index: 1000;
            display: none;
        `;                                                                   // <-- Apply panel styles
        
        // CREATE PANEL TITLE
        const title = document.createElement('h3');                          // <-- Create title element
        title.textContent = 'Debug Tools';                                   // <-- Set title text
        title.style.cssText = `
            margin: 0 0 10px 0;
            color: #4CAF50;
            border-bottom: 1px solid #333;
            padding-bottom: 5px;
        `;                                                                   // <-- Apply title styles
        debugPanel.appendChild(title);                                       // <-- Add title to panel
        
        // CREATE WAYPOINT ORBS CONTROL
        createDebugToggle(
            'Waypoint Orbs',
            waypointOrbsEnabled,
            toggleWaypointOrbs
        );
        
        // CREATE CAMERA AGENT MARKERS CONTROL
        createDebugToggle(
            'Camera Agent Markers',
            cameraAgentMarkersVisible,
            toggleCameraAgentMarkers
        );
        
        // CREATE MESH COUNT DISPLAY
        const meshCount = document.createElement('div');                     // <-- Create mesh count display
        meshCount.style.cssText = `
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #333;
            color: #888;
        `;                                                                   // <-- Apply count styles
        meshCount.textContent = `Camera Agents Found: ${cameraAgentMeshes.length}`; // <-- Set count text
        debugPanel.appendChild(meshCount);                                   // <-- Add count to panel
        
        // ADD PANEL TO DOCUMENT
        document.body.appendChild(debugPanel);                               // <-- Add panel to page
        
        // CREATE TOGGLE BUTTON
        createDebugToggleButton();                                           // <-- Create panel toggle button
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Create Debug Toggle Control
    // ---------------------------------------------------------------
    function createDebugToggle(label, initialState, toggleFunction) {
        const container = document.createElement('div');                     // <-- Create control container
        container.style.cssText = `
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;                                                                   // <-- Apply container styles
        
        // CREATE LABEL
        const labelElement = document.createElement('span');                 // <-- Create label element
        labelElement.textContent = label;                                    // <-- Set label text
        labelElement.style.cssText = `
            color: #ccc;
        `;                                                                   // <-- Apply label styles
        
        // CREATE TOGGLE BUTTON
        const button = document.createElement('button');                     // <-- Create toggle button
        button.textContent = initialState ? 'ON' : 'OFF';                   // <-- Set initial text
        button.style.cssText = `
            background: ${initialState ? '#4CAF50' : '#666'};
            color: white;
            border: none;
            padding: 3px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
        `;                                                                   // <-- Apply button styles
        
        // ADD CLICK HANDLER
        button.addEventListener('click', () => {
            const newState = toggleFunction();                               // <-- Call toggle function
            button.textContent = newState ? 'ON' : 'OFF';                    // <-- Update button text
            button.style.background = newState ? '#4CAF50' : '#666';         // <-- Update button color
        });
        
        // ASSEMBLE CONTROL
        container.appendChild(labelElement);                                 // <-- Add label to container
        container.appendChild(button);                                       // <-- Add button to container
        debugPanel.appendChild(container);                                   // <-- Add control to panel
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Create Debug Panel Toggle Button
    // ---------------------------------------------------------------
    function createDebugToggleButton() {
        const toggleButton = document.createElement('button');               // <-- Create toggle button
        toggleButton.textContent = 'Debug';                                  // <-- Set button text
        toggleButton.style.cssText = `
            position: fixed;
            top: 10px;
            right: 270px;
            background: #333;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            z-index: 1001;
        `;                                                                   // <-- Apply button styles
        
        // ADD CLICK HANDLER
        toggleButton.addEventListener('click', () => {
            debugPanelVisible = !debugPanelVisible;                          // <-- Toggle panel visibility
            debugPanel.style.display = debugPanelVisible ? 'block' : 'none'; // <-- Apply visibility
            toggleButton.style.background = debugPanelVisible ? '#4CAF50' : '#333'; // <-- Update button color
        });
        
        document.body.appendChild(toggleButton);                             // <-- Add button to page
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Public API Methods
// -----------------------------------------------------------------------------

    // FUNCTION | Refresh Camera Agent Detection
    // ------------------------------------------------------------
    function refreshCameraAgentDetection() {
        if (initialized) {
            findCameraAgentMeshes();                                         // <-- Re-scan for camera agents
            setCameraAgentMarkersVisibility(cameraAgentMarkersVisible);      // <-- Apply current visibility
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Current Debug States
    // ------------------------------------------------------------
    function getDebugStates() {
        return {
            waypointOrbs: waypointOrbsEnabled,                               // <-- Waypoint orbs state
            cameraAgentMarkers: cameraAgentMarkersVisible,                   // <-- Camera agent markers state
            cameraAgentCount: cameraAgentMeshes.length                       // <-- Number of camera agents found
        };
    }
    // ---------------------------------------------------------------

    // FUNCTION | Update Configuration and Apply Changes
    // ------------------------------------------------------------
    function updateConfiguration(newConfig) {
        if (newConfig) {
            appConfig = newConfig;                                           // <-- Update config reference
            loadConfigurationSettings();                                     // <-- Reload settings
            
            // APPLY NEW SETTINGS
            setCameraAgentMarkersVisibility(cameraAgentMarkersVisible);      // <-- Apply camera agent visibility
            setWaypointOrbsVisibility(waypointOrbsEnabled);                  // <-- Apply waypoint orb visibility
            
            console.log("DevTools: Configuration updated and applied");      // <-- Log update
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Export
// -----------------------------------------------------------------------------

    // EXPORT PUBLIC API
    window.TrueVision3D.DevTools.DebugMarkersManager = {
        initialize: initialize,                                              // <-- Initialize debug manager
        shouldShowWaypointOrbs: shouldShowWaypointOrbs,                      // <-- Check waypoint orb visibility
        toggleWaypointOrbs: toggleWaypointOrbs,                              // <-- Toggle waypoint orbs
        toggleCameraAgentMarkers: toggleCameraAgentMarkers,                  // <-- Toggle camera agent markers
        refreshCameraAgentDetection: refreshCameraAgentDetection,            // <-- Refresh camera agent detection
        getDebugStates: getDebugStates,                                      // <-- Get current debug states
        updateConfiguration: updateConfiguration                             // <-- Update configuration
    };

// endregion -------------------------------------------------------------------

})(); 