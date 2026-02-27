// -----------------------------------------------------------------------------
// REGION | Navmode - Orbit Controls Damping Delegation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Clamp Damping Factor
    // ------------------------------------------------------------
    function Na__Navmode__ClampDampingFactor(rawValue) {
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return 0.08;
        if (value < 0) return 0;
        if (value > 1) return 1;
        return value;
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply Damping Config To Orbit Controls
    // ------------------------------------------------------------
    function Na__Navmode__ApplyOrbitControlsDamping(controls, dampingConfig) {
        if (!controls) return;

        const config = dampingConfig || {};
        const enableDamping = config.enabled === true;
        const dampingFactor = Na__Navmode__ClampDampingFactor(config.factor);

        controls.enableDamping = enableDamping;
        controls.dampingFactor = dampingFactor;
    }
    // ------------------------------------------------------------


    // MODULE EXPORTS | Orbit Controls Damping API
    // ------------------------------------------------------------
    export {
        Na__Navmode__ApplyOrbitControlsDamping
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
