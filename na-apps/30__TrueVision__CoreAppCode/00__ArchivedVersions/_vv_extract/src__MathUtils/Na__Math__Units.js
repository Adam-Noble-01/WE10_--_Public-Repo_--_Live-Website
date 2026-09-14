// -----------------------------------------------------------------------------
// REGION | Math Utilities - Unit Conversion
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Unit Conversion Ratios
    // ------------------------------------------------------------
    const Na__Math__MmPerUnit = 1000; // <-- 1000 mm = 1 unit (meters)
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Millimeters to Units
    // ------------------------------------------------------------
    function Na__Math__ConvertMmToUnits(mmValue) {
        if (!Number.isFinite(mmValue)) return 0;
        return mmValue / Na__Math__MmPerUnit; // <-- MM to unit conversion
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Units to Millimeters
    // ------------------------------------------------------------
    function Na__Math__ConvertUnitsToMm(unitsValue) {
        if (!Number.isFinite(unitsValue)) return 0;
        return unitsValue * Na__Math__MmPerUnit; // <-- Unit to MM conversion
    }
    // ------------------------------------------------------------


    // MODULE EXPORTS | Math Utilities API
    // ------------------------------------------------------------
    export {
        Na__Math__MmPerUnit,
        Na__Math__ConvertMmToUnits,
        Na__Math__ConvertUnitsToMm
    };
    // ------------------------------------------------------------

// endregion ----------------------------------------------------
