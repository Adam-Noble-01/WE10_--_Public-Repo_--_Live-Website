// =============================================================================
// VALEDESIGNSUITE - TRUEVISION 3D SOLAR ORIENTATION CONTROLS
// =============================================================================
// 
// FILE       : SceneConfig_SolarOrientationControlLogic.js
// NAMESPACE  : TrueVision3D.SolarOrientationControls
// MODULE     : Solar Position Calculation and Lighting Management
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Manage solar positioning and directional lighting based on time and geography
// CREATED    : 2025
// 
// DESCRIPTION:
// - Calculates real-time sun position based on time of day and geographical coordinates
// - Provides solar altitude and azimuth calculations for architectural lighting simulation
// - Manages directional lighting updates based on building orientation and site location
// - Supports principal elevation orientation for accurate shadow casting
// - Includes time-based light intensity adjustments for realistic day cycle simulation
// - Integrates with UI controls for interactive sun positioning
// 
// -----------------------------------------------------------------------------
// 
// DEVELOPMENT LOG:
// 2025 - Version 1.0.0
// - Initial Release
// - Solar position calculation algorithms implemented
// - Principal elevation offset system added
// - Time-based UI controls integrated
// 
// =============================================================================

// Ensure TrueVision3D namespace exists
window.TrueVision3D = window.TrueVision3D || {};
window.TrueVision3D.SolarOrientationControls = window.TrueVision3D.SolarOrientationControls || {};

(function() {
'use strict';

// -----------------------------------------------------------------------------
// REGION | Solar Configuration Constants and Site Data
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Geographical Coordinates and Site Information
    // ------------------------------------------------------------
    const GLOBAL_COORDINATES = {
        latitude                       : 52.9449,                            // <-- Nottingham, UK latitude coordinate
        longitude                      : -1.2245                             // <-- Nottingham, UK longitude coordinate
    };
    // ---------------------------------------------------------------

    // MODULE CONSTANTS | Site Orientation and Environmental Settings
    // ------------------------------------------------------------
    const PRINCIPAL_ELEVATION          = "West";                             // <-- Building principal elevation direction
    const GROUND_OFFSET                = -1.25;                              // <-- Ground plane offset in metres
    const CAMERA_OFFSET                = 10;                                 // <-- Additional camera positioning offset
    // ---------------------------------------------------------------

    // MODULE CONSTANTS | Solar Simulation Parameters
    // ------------------------------------------------------------
    const SOLAR_ALTITUDE_MIN           = 20;                                 // <-- Minimum sun altitude in degrees
    const SOLAR_ALTITUDE_MAX           = 60;                                 // <-- Maximum sun altitude in degrees
    const SOLAR_AZIMUTH_MORNING_START  = 110;                               // <-- Morning azimuth start angle
    const SOLAR_AZIMUTH_NOON           = 180;                               // <-- Noon azimuth angle
    const SOLAR_AZIMUTH_EVENING_END    = 250;                               // <-- Evening azimuth end angle
    const TIME_START_HOUR              = 9;                                  // <-- Simulation start hour
    const TIME_NOON_HOUR               = 12;                                 // <-- Noon reference hour
    const TIME_END_HOUR                = 15;                                 // <-- Simulation end hour
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Lighting System References
    // ------------------------------------------------------------
    let sunLight                       = null;                               // <-- Babylon.js sun light reference
    let scene                          = null;                               // <-- Babylon.js scene reference
    let sunTimeSlider                  = null;                               // <-- Time slider UI element
    let sunTimeDisplay                 = null;                               // <-- Time display UI element
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Solar Position Calculation Mathematics
// -----------------------------------------------------------------------------

    // FUNCTION | Calculate Sun Altitude Based on Time of Day
    // ------------------------------------------------------------
    function computeSunAltitude(hour) {
        let altitudeDeg;                                                     // <-- Altitude angle in degrees
        
        if (hour <= TIME_NOON_HOUR) {                                        // <-- Morning to noon calculation
            altitudeDeg = SOLAR_ALTITUDE_MIN + (hour - TIME_START_HOUR) * 
                         (SOLAR_ALTITUDE_MAX - SOLAR_ALTITUDE_MIN) / 
                         (TIME_NOON_HOUR - TIME_START_HOUR);                 // <-- Linear interpolation morning
        } else {                                                             // <-- Afternoon calculation
            altitudeDeg = SOLAR_ALTITUDE_MAX - (hour - TIME_NOON_HOUR) * 
                         (SOLAR_ALTITUDE_MAX - 30) / 
                         (TIME_END_HOUR - TIME_NOON_HOUR);                   // <-- Linear interpolation afternoon
        }
        
        return altitudeDeg * (Math.PI / 180);                               // <-- Convert degrees to radians
    }
    // ---------------------------------------------------------------

    // FUNCTION | Calculate Sun Azimuth with Principal Elevation Offset
    // ------------------------------------------------------------
    function computeSunAzimuth(hour) {
        let azimuthDeg;                                                      // <-- Azimuth angle in degrees
        
        if (hour <= TIME_NOON_HOUR) {                                        // <-- Morning to noon calculation
            azimuthDeg = SOLAR_AZIMUTH_MORNING_START + (hour - TIME_START_HOUR) * 
                        (SOLAR_AZIMUTH_NOON - SOLAR_AZIMUTH_MORNING_START) / 
                        (TIME_NOON_HOUR - TIME_START_HOUR);                  // <-- Linear interpolation morning
        } else {                                                             // <-- Afternoon calculation
            azimuthDeg = SOLAR_AZIMUTH_NOON + (hour - TIME_NOON_HOUR) * 
                        (SOLAR_AZIMUTH_EVENING_END - SOLAR_AZIMUTH_NOON) / 
                        (TIME_END_HOUR - TIME_NOON_HOUR);                    // <-- Linear interpolation afternoon
        }
        
        // CALCULATE PRINCIPAL ELEVATION OFFSET
        let offset = calculatePrincipalElevationOffset();                    // <-- Get building orientation offset
        
        let adjustedAzimuth = (azimuthDeg + offset) % 360;                   // <-- Apply offset and normalize
        return adjustedAzimuth * (Math.PI / 180);                           // <-- Convert degrees to radians
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Calculate Principal Elevation Offset Based on Building Orientation
    // ---------------------------------------------------------------
    function calculatePrincipalElevationOffset() {
        let offset = 0;                                                      // <-- Default offset for North orientation
        
        switch (PRINCIPAL_ELEVATION) {
            case "North":                                                    // <-- North facing building
                offset = 0;                                                  // <-- No offset required
                break;
            case "East":                                                     // <-- East facing building
                offset = 90;                                                 // <-- 90 degree offset
                break;
            case "South":                                                    // <-- South facing building
                offset = 180;                                                // <-- 180 degree offset
                break;
            case "West":                                                     // <-- West facing building
                offset = 270;                                                // <-- 270 degree offset
                break;
            default:                                                         // <-- Default to North if unknown
                offset = 0;                                                  // <-- Default offset
                break;
        }
        
        return offset;                                                       // <-- Return calculated offset
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Dynamic Sun Position and Lighting Updates
// -----------------------------------------------------------------------------

    // FUNCTION | Update Sun Light Direction Based on Time Selection
    // ------------------------------------------------------------
    function updateSunPosition(selectedHour) {
        if (!sunLight) {
            console.warn("Sun light not initialized for position update");   // <-- Log warning if not ready
            return;
        }
        
        const altitude = computeSunAltitude(selectedHour);                   // <-- Calculate sun altitude angle
        const azimuth = computeSunAzimuth(selectedHour);                     // <-- Calculate sun azimuth angle
        
        // CONVERT SPHERICAL COORDINATES TO CARTESIAN DIRECTION VECTOR
        const x = Math.cos(altitude) * Math.sin(azimuth);                    // <-- X component calculation
        const y = Math.sin(altitude);                                        // <-- Y component calculation
        const z = Math.cos(altitude) * Math.cos(azimuth);                    // <-- Z component calculation
        
        sunLight.direction = new BABYLON.Vector3(-x, -y, -z);                // <-- Set light direction vector
        
        // UPDATE LIGHT INTENSITY BASED ON TIME OF DAY
        updateSunIntensity(selectedHour);                                    // <-- Adjust light intensity
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Update Sun Light Intensity Based on Time
    // ---------------------------------------------------------------
    function updateSunIntensity(selectedHour) {
        let intensity = 2.5;                                                 // <-- Default intensity value
        
        // REDUCE INTENSITY AT BEGINNING AND END OF DAY
        if (selectedHour < TIME_START_HOUR + 1) {                           // <-- Early morning
            intensity = 1.5 + (selectedHour - TIME_START_HOUR) * 1.0;       // <-- Gradual increase
        } else if (selectedHour > TIME_END_HOUR - 1) {                      // <-- Late afternoon
            intensity = 2.5 - (selectedHour - (TIME_END_HOUR - 1)) * 1.0;   // <-- Gradual decrease
        }
        
        sunLight.intensity = Math.max(intensity, 1.0);                       // <-- Ensure minimum intensity
    }
    // ---------------------------------------------------------------

    // FUNCTION | Initialize Sun Position Using Default Slider Value
    // ------------------------------------------------------------
    function initializeSunPosition() {
        if (!sunTimeSlider) {
            console.warn("Sun time slider not available for initialization"); // <-- Log warning if not ready
            return;
        }
        
        updateSunPosition(parseFloat(sunTimeSlider.value));                  // <-- Set initial sun position
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | User Interface Time Control Management
// -----------------------------------------------------------------------------

    // FUNCTION | Process Sun Time Slider Input and Update Display
    // ------------------------------------------------------------
    function handleSunTimeChange() {
        if (!sunTimeSlider || !sunTimeDisplay) {
            console.warn("Sun time controls not available");                 // <-- Log warning if not ready
            return;
        }
        
        const selectedHour = parseFloat(sunTimeSlider.value);                // <-- Get slider value as number
        const displayHour = Math.floor(selectedHour);                       // <-- Extract whole hour portion
        const displayMinutes = Math.round((selectedHour - displayHour) * 60); // <-- Calculate minutes from decimal
        
        // FORMAT TIME STRING WITH LEADING ZEROS
        const timeString = displayHour.toString().padStart(2, '0') + ":" + 
                          displayMinutes.toString().padStart(2, '0');       // <-- Format as HH:MM
        
        sunTimeDisplay.textContent = timeString;                             // <-- Update display text
        updateSunPosition(selectedHour);                                     // <-- Update sun light position
    }
    // ---------------------------------------------------------------

    // FUNCTION | Register Event Handlers for Solar Controls
    // ------------------------------------------------------------
    function registerSolarEventHandlers() {
        if (sunTimeSlider) {
            sunTimeSlider.addEventListener("input", handleSunTimeChange);    // <-- Time slider change handler
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Public API Interface for Solar Orientation System
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Solar Orientation Control System
    // ------------------------------------------------------------
    function initialize(babylonScene, sunLightReference, timeSlider, timeDisplay) {
        scene = babylonScene;                                                // <-- Store scene reference
        sunLight = sunLightReference;                                        // <-- Store sun light reference
        sunTimeSlider = timeSlider;                                          // <-- Store time slider reference
        sunTimeDisplay = timeDisplay;                                        // <-- Store time display reference
        
        initializeSunPosition();                                             // <-- Set initial sun position
        registerSolarEventHandlers();                                        // <-- Setup event handlers
        
        console.log("Solar orientation controls initialized successfully");   // <-- Log initialization success
        return true;                                                         // <-- Return success
    }
    // ---------------------------------------------------------------

    // FUNCTION | Update Sun Position Externally
    // ------------------------------------------------------------
    function setSunPosition(hour) {
        updateSunPosition(hour);                                             // <-- Update sun position
    }
    // ---------------------------------------------------------------

    // FUNCTION | Get Current Solar Configuration
    // ------------------------------------------------------------
    function getSolarConfiguration() {
        return {
            coordinates: GLOBAL_COORDINATES,                                 // <-- Return coordinates
            principalElevation: PRINCIPAL_ELEVATION,                         // <-- Return building orientation
            timeRange: {
                start: TIME_START_HOUR,                                      // <-- Return start time
                noon: TIME_NOON_HOUR,                                        // <-- Return noon time
                end: TIME_END_HOUR                                           // <-- Return end time
            }
        };
    }
    // ---------------------------------------------------------------

    // FUNCTION | Cleanup Solar Orientation Resources
    // ------------------------------------------------------------
    function dispose() {
        // REMOVE EVENT LISTENERS
        if (sunTimeSlider) {
            sunTimeSlider.removeEventListener("input", handleSunTimeChange); // <-- Remove event listener
        }
        
        // CLEAR REFERENCES
        scene = null;                                                        // <-- Clear scene reference
        sunLight = null;                                                     // <-- Clear light reference
        sunTimeSlider = null;                                                // <-- Clear slider reference
        sunTimeDisplay = null;                                               // <-- Clear display reference
        
        console.log("Solar orientation controls disposed");                  // <-- Log disposal
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

// -----------------------------------------------------------------------------
// REGION | Module Export and Public Interface
// -----------------------------------------------------------------------------

    // EXPOSE PUBLIC API
    window.TrueVision3D.SolarOrientationControls = {
        initialize: initialize,                                              // <-- Initialize function
        setSunPosition: setSunPosition,                                      // <-- Set sun position function
        getSolarConfiguration: getSolarConfiguration,                        // <-- Get configuration function
        dispose: dispose,                                                    // <-- Cleanup function
        handleSunTimeChange: handleSunTimeChange                             // <-- Time change handler
    };

// endregion -------------------------------------------------------------------

})(); 