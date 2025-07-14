// =============================================================================
// VALEDESIGNSUITE - TRUEVISION 3D UI NAVIGATION MODE BUTTON MANAGER
// =============================================================================
//
// FILE       : UiMenu_NavModeButtonManager.js
// NAMESPACE  : TrueVision3D.UiMenu
// MODULE     : NavModeButtonManager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Centralized UI management for navigation mode switching controls
// CREATED    : 2025
//
// DESCRIPTION:
// - Manages the user interface buttons for switching between navigation modes
// - Handles visual feedback and state updates for active navigation mode buttons
// - Coordinates button click events with navigation mode enable/disable logic
// - Provides centralized control for the left-hand toolbar navigation buttons
// - Maintains button visual states (active, inactive, hover) for user feedback
// - Acts as the UI layer bridge between user interactions and navigation system
// - Distinct from the navigation modes themselves - this manages only UI aspects
//
// IMPORTANT NOTES:
// - This module specifically handles the UI buttons in the left toolbar
// - It does NOT control the actual navigation camera behavior
// - Each navigation mode (Waypoint, Walk, Orbit, Fly) has its own logic module
// - This manager coordinates switching between modes via button interactions
// - Button visibility is controlled by the ApplicationCore based on config
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 2025 - Version 1.0.0
// - Initial implementation of navigation button UI management
// - Button state management and visual feedback system
// - Event-driven architecture for mode switching
// - Integration with navigation mode modules
//
// 2025 - Version 1.1.0
// - Renamed from NavigationButtonUIManager to UiMenu_NavModeButtonManager
// - Enhanced documentation to clarify UI-specific responsibilities
// - Improved separation of concerns between UI and navigation logic
//
// =============================================================================

// Ensure TrueVision3D namespace exists
window.TrueVision3D = window.TrueVision3D || {};
window.TrueVision3D.UiMenu = window.TrueVision3D.UiMenu || {};

// -----------------------------------------------------------------------------
// REGION | Navigation Mode Button UI Manager Module Implementation
// -----------------------------------------------------------------------------

window.TrueVision3D.UiMenu.NavModeButtonManager = (function() {

    // MODULE CONSTANTS | Button Visual Style Configuration
    // ------------------------------------------------------------
    const BUTTON_COLORS = {
        ACTIVE                 : '#4CAF50',                                  // <-- Active mode green highlight
        INACTIVE               : '#555041',                                  // <-- Default Noble Architecture brand color
        HOVER                  : '#666655'                                   // <-- Hover state subtle highlight
    };
    // ------------------------------------------------------------

    // MODULE VARIABLES | UI State and Reference Management
    // ------------------------------------------------------------
    let currentMode          = null;                                         // <-- Currently active navigation mode name
    let navigationModes      = {};                                           // <-- Reference to available navigation mode modules
    let modeButtons          = {};                                           // <-- DOM button element references
    let scene                = null;                                         // <-- Babylon.js scene reference
    let canvas               = null;                                         // <-- Canvas element reference
    let onModeChangeCallback = null;                                         // <-- Callback for mode change notifications
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Initialization and Setup Functions
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Navigation Mode Button Manager
    // ------------------------------------------------------------
    function initialize(babylonScene, targetCanvas, modes, buttons) {
        scene = babylonScene;                                                // <-- Store scene reference
        canvas = targetCanvas;                                               // <-- Store canvas reference
        navigationModes = modes;                                             // <-- Store available navigation modes
        modeButtons = buttons;                                               // <-- Store button DOM references
        
        // DEBUG: Log available navigation modes
        console.log("Available navigation modes:", Object.keys(navigationModes));
        console.log("Available buttons:", Object.keys(buttons));
        
        setupButtonEventListeners();                                         // <-- Configure button click handlers
        console.log("UI Menu - Navigation Mode Button Manager initialized"); // <-- Log initialization success
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Setup Button Event Listeners for User Interactions
    // ---------------------------------------------------------------
    function setupButtonEventListeners() {
        Object.entries(modeButtons).forEach(([modeName, button]) => {        // <-- Iterate through all buttons
            if (button && button.style.display !== 'none') {                 // <-- Check button exists and visible
                button.addEventListener('click', () => switchMode(modeName)); // <-- Add click handler for mode switch
                button.addEventListener('mouseenter', () => handleButtonHover(button, true));  // <-- Hover enter effect
                button.addEventListener('mouseleave', () => handleButtonHover(button, false)); // <-- Hover leave effect
            }
        });
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Navigation Mode Switching and State Management
// -----------------------------------------------------------------------------

    // FUNCTION | Switch Active Navigation Mode via UI Button Click
    // ------------------------------------------------------------
    function switchMode(modeName) {
        if (!navigationModes[modeName] || modeName === currentMode) return;  // <-- Validate mode change request
        
        // DISABLE CURRENT MODE
        if (currentMode && navigationModes[currentMode]) {
            navigationModes[currentMode].disable();                          // <-- Call disable on current mode
        }
        
        // ENABLE NEW MODE
        const newMode = navigationModes[modeName];                           // <-- Get new mode module reference
        console.log(`Attempting to enable ${modeName} navigation mode...`);  // <-- Debug log
        newMode.enable();                                                    // <-- Activate the new navigation mode
        
        // VERIFY MODE WAS ENABLED SUCCESSFULLY
        const isNowEnabled = newMode.isEnabled();
        console.log(`${modeName} navigation mode enabled: ${isNowEnabled}`); // <-- Debug verification
        
        if (isNowEnabled) {
            currentMode = modeName;                                          // <-- Update current mode tracking
            updateButtonStates();                                            // <-- Update all button visual states
        } else {
            console.error(`Failed to enable ${modeName} navigation mode`);   // <-- Error log
            return;                                                          // <-- Exit if enable failed
        }
        
        // TRIGGER MODE CHANGE CALLBACK
        if (onModeChangeCallback) {
            onModeChangeCallback(modeName, newMode);                        // <-- Notify listeners of mode change
        }
        
        console.log(`UI switched to ${modeName} navigation mode`);           // <-- Log mode switch
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Update Visual States of All Navigation Buttons
    // ---------------------------------------------------------------
    function updateButtonStates() {
        Object.entries(modeButtons).forEach(([modeName, button]) => {        // <-- Process each button
            if (button && button.style.display !== 'none') {
                const isActive = modeName === currentMode;                   // <-- Check if this is active mode
                
                button.classList.toggle('active', isActive);                 // <-- Toggle active CSS class
                button.style.backgroundColor = isActive ? 
                    BUTTON_COLORS.ACTIVE : BUTTON_COLORS.INACTIVE;          // <-- Set appropriate background color
                button.style.fontWeight = isActive ? 'bold' : 'normal';     // <-- Bold text for active button
                button.style.boxShadow = isActive ? 
                    '0 2px 8px rgba(76, 175, 80, 0.4)' : 'none';           // <-- Shadow effect for active button
            }
        });
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Handle Button Hover Visual Effects
    // ---------------------------------------------------------------
    function handleButtonHover(button, isHovering) {
        if (button.classList.contains('active')) return;                     // <-- Skip hover effect on active button
        
        button.style.backgroundColor = isHovering ? 
            BUTTON_COLORS.HOVER : BUTTON_COLORS.INACTIVE;                   // <-- Apply/remove hover color
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | External Interface and Callback Management
// -----------------------------------------------------------------------------

    // FUNCTION | Set Callback for Navigation Mode Change Events
    // ------------------------------------------------------------
    function onModeChange(callback) {
        onModeChangeCallback = callback;                                     // <-- Store external callback reference
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Current Active Navigation Mode Information
    // ------------------------------------------------------------
    function getCurrentMode() {
        return {
            name: currentMode,                                               // <-- Current mode name string
            instance: navigationModes[currentMode]                           // <-- Mode module instance reference
        };
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Public API Export
// -----------------------------------------------------------------------------

    // MODULE PUBLIC API | Exposed Methods for External Use
    // ------------------------------------------------------------
    return {
        initialize: initialize,                                              // <-- Initialize button manager
        switchMode: switchMode,                                              // <-- Programmatically switch modes
        getCurrentMode: getCurrentMode,                                      // <-- Get current mode information
        onModeChange: onModeChange,                                          // <-- Register mode change callback
        updateButtonStates: updateButtonStates                              // <-- Force button state refresh
    };
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

})(); 

// MARK MODULE AS LOADED
if (window.TrueVision3D.ModuleDependencyManager) {
    window.TrueVision3D.ModuleDependencyManager.markModuleLoaded('UiMenu');
} 