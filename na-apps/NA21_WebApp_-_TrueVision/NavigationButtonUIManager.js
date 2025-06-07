// =============================================================================
// TRUEVISION 3D - NAVIGATION BUTTON UI MANAGER MODULE
// =============================================================================
//
// FILE       : NavigationButtonUIManager.js
// MODULE     : NavigationButtonUIManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Centralized navigation mode management and UI control
// CREATED    : 2025
//
// DESCRIPTION:
// - Manages navigation mode switching and button state updates
// - Handles UI feedback for active navigation modes
// - Centralizes navigation logic to reduce code duplication
// - Provides event-driven architecture for navigation changes
//
// =============================================================================

window.TrueVision3D = window.TrueVision3D || {};

// -----------------------------------------------------------------------------
// REGION | Navigation Button UI Manager Module Implementation
// -----------------------------------------------------------------------------

window.TrueVision3D.NavigationButtonUIManager = (function() {

    // MODULE CONSTANTS | Button Colors and Styles
    // ------------------------------------------------------------
    const BUTTON_COLORS = {
        ACTIVE                 : '#4CAF50',                                  // <-- Active mode green
        INACTIVE               : '#555041',                                  // <-- Default brand color
        HOVER                  : '#666655'                                   // <-- Hover state color
    };
    // ------------------------------------------------------------

    // MODULE VARIABLES | State Management
    // ------------------------------------------------------------
    let currentMode          = null;                                         // <-- Currently active mode
    let navigationModes      = {};                                           // <-- Available navigation modes
    let modeButtons          = {};                                           // <-- Button element references
    let scene                = null;                                         // <-- Babylon scene reference
    let canvas               = null;                                         // <-- Canvas element reference
    let onModeChangeCallback = null;                                         // <-- Mode change event handler
    // ------------------------------------------------------------

    // FUNCTION | Initialize Navigation Manager
    // ------------------------------------------------------------
    function initialize(babylonScene, targetCanvas, modes, buttons) {
        scene = babylonScene;                                                // <-- Store scene reference
        canvas = targetCanvas;                                               // <-- Store canvas reference
        navigationModes = modes;                                             // <-- Store available modes
        modeButtons = buttons;                                               // <-- Store button references
        
        setupButtonEventListeners();                                         // <-- Configure button events
        console.log("Navigation Button UI Manager initialized");             // <-- Log initialization
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Setup Button Event Listeners
    // ---------------------------------------------------------------
    function setupButtonEventListeners() {
        Object.entries(modeButtons).forEach(([modeName, button]) => {        // <-- Iterate button entries
            if (button && button.style.display !== 'none') {                 // <-- Check button exists
                button.addEventListener('click', () => switchMode(modeName)); // <-- Add click handler
                button.addEventListener('mouseenter', () => handleButtonHover(button, true)); // <-- Hover enter
                button.addEventListener('mouseleave', () => handleButtonHover(button, false)); // <-- Hover leave
            }
        });
    }
    // ---------------------------------------------------------------

    // FUNCTION | Switch Navigation Mode
    // ------------------------------------------------------------
    function switchMode(modeName) {
        if (!navigationModes[modeName] || modeName === currentMode) return;  // <-- Validate mode change
        
        // DISABLE CURRENT MODE
        if (currentMode && navigationModes[currentMode]) {
            navigationModes[currentMode].disable();                          // <-- Disable current mode
        }
        
        // ENABLE NEW MODE
        const newMode = navigationModes[modeName];                           // <-- Get new mode reference
        newMode.enable();                                                    // <-- Enable new mode
        currentMode = modeName;                                              // <-- Update current mode
        
        updateButtonStates();                                                // <-- Update UI buttons
        updateWaypointControls(modeName === 'waypoint');                    // <-- Show/hide waypoint controls
        
        // TRIGGER CALLBACK
        if (onModeChangeCallback) {
            onModeChangeCallback(modeName, newMode);                        // <-- Call mode change handler
        }
        
        console.log(`Switched to ${modeName} navigation mode`);              // <-- Log mode change
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Update Button Visual States
    // ---------------------------------------------------------------
    function updateButtonStates() {
        Object.entries(modeButtons).forEach(([modeName, button]) => {        // <-- Iterate all buttons
            if (button && button.style.display !== 'none') {
                const isActive = modeName === currentMode;                   // <-- Check if active mode
                
                button.classList.toggle('active', isActive);                 // <-- Toggle active class
                button.style.backgroundColor = isActive ? 
                    BUTTON_COLORS.ACTIVE : BUTTON_COLORS.INACTIVE;          // <-- Set button color
                button.style.fontWeight = isActive ? 'bold' : 'normal';     // <-- Set font weight
                button.style.boxShadow = isActive ? 
                    '0 2px 8px rgba(76, 175, 80, 0.4)' : 'none';           // <-- Add shadow to active
            }
        });
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Button Hover Effects
    // ---------------------------------------------------------------
    function handleButtonHover(button, isHovering) {
        if (button.classList.contains('active')) return;                     // <-- Skip if active button
        
        button.style.backgroundColor = isHovering ? 
            BUTTON_COLORS.HOVER : BUTTON_COLORS.INACTIVE;                   // <-- Apply hover color
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Update Waypoint-Specific Controls
    // ---------------------------------------------------------------
    function updateWaypointControls(showControls) {
        const waypointUI = document.getElementById('waypoint-navigation-controls'); // <-- Get waypoint UI controls
        if (waypointUI) {
            waypointUI.style.display = showControls ? 'block' : 'none';      // <-- Show/hide UI controls
        }
    }
    // ---------------------------------------------------------------

    // FUNCTION | Set Mode Change Callback
    // ------------------------------------------------------------
    function onModeChange(callback) {
        onModeChangeCallback = callback;                                     // <-- Store callback reference
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Current Navigation Mode
    // ------------------------------------------------------------
    function getCurrentMode() {
        return {
            name: currentMode,                                               // <-- Current mode name
            instance: navigationModes[currentMode]                           // <-- Mode instance reference
        };
    }
    // ---------------------------------------------------------------

    // MODULE PUBLIC API | Exposed Methods
    // ------------------------------------------------------------
    return {
        initialize: initialize,                                              // <-- Initialize manager
        switchMode: switchMode,                                              // <-- Switch navigation mode
        getCurrentMode: getCurrentMode,                                      // <-- Get current mode info
        onModeChange: onModeChange,                                          // <-- Set mode change handler
        updateButtonStates: updateButtonStates                              // <-- Force button update
    };
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

})(); 