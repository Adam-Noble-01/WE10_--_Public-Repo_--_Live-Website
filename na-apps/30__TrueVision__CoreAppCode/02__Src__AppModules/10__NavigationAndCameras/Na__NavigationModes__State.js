// =============================================================================
// TRUEVISION3D - NAVIGATION MODES ENABLED STATE
// =============================================================================
//
// FILE       : Na__NavigationModes__State.js
// NAMESPACE  : Na__NavigationModes
// MODULE     : Navigation Modes State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Shared accessor for per-model navigation mode enable flags
// CREATED    : 21-Jun-2026
//
// DESCRIPTION:
// - Single source of truth for which navigation modes are enabled for the
//   current model session.
// - Orbit is always available and is never stored here (it is the default).
// - Walk and Fly flags default to false; set to true by the loading sequence
//   after reading the project data (Navmode__EnabledModes key).
// - Consumed by the floating navigation toolbar (to decide button visibility)
//   and by the hotkey registration (to gate Walk/Fly hotkeys).
//
// INTEGRATION:
// - Call Na__NavigationModes__SetEnabledModes() from the loading sequence
//   after project data is read.
// - Read Na__NavigationModes__IsWalkEnabled() / Na__NavigationModes__IsFlyEnabled()
//   from any module that needs to react to the enabled flags.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Jun-2026 - Version 1.0.0
// - Ported from ValeVision3D as part of the navigation toolbar transplant.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Enabled Navigation Mode Flags
    // ------------------------------------------------------------
    let Na__NavigationModes__WalkEnabled  = false;   // <-- Walk mode available for this model
    let Na__NavigationModes__FlyEnabled   = false;   // <-- Fly mode available for this model
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Setters
// -----------------------------------------------------------------------------

    // FUNCTION | Apply Enabled Modes from Project Data
    // ------------------------------------------------------------
    function Na__NavigationModes__SetEnabledModes(enabledModesConfig) {
        if (!enabledModesConfig) return;

        Na__NavigationModes__WalkEnabled = Boolean(enabledModesConfig.Navmode__EnabledModes__Walk);
        Na__NavigationModes__FlyEnabled  = Boolean(enabledModesConfig.Navmode__EnabledModes__Fly);

        console.log(`[NavigationModes] Enabled modes resolved - Walk: ${Na__NavigationModes__WalkEnabled}, Fly: ${Na__NavigationModes__FlyEnabled}`);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public Getters
// -----------------------------------------------------------------------------

    // FUNCTION | Is Walk Mode Enabled for This Model?
    // ------------------------------------------------------------
    function Na__NavigationModes__IsWalkEnabled() {
        return Na__NavigationModes__WalkEnabled;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Fly Mode Enabled for This Model?
    // ------------------------------------------------------------
    function Na__NavigationModes__IsFlyEnabled() {
        return Na__NavigationModes__FlyEnabled;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is More Than One Mode Available?
    // ------------------------------------------------------------
    function Na__NavigationModes__HasMultipleModes() {
        return Na__NavigationModes__WalkEnabled || Na__NavigationModes__FlyEnabled;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Navigation Modes State API
    // ------------------------------------------------------------
    export {
        Na__NavigationModes__SetEnabledModes,
        Na__NavigationModes__IsWalkEnabled,
        Na__NavigationModes__IsFlyEnabled,
        Na__NavigationModes__HasMultipleModes
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
