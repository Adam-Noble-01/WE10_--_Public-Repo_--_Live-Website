// =========================================================
// THERMAL CALC TOOL - MATH UTILITIES
// =========================================================
//
// FILENAME  |  NA23_01_05-WebApp_-_ThermalCalcTool_-_MathUtils.js
// DIRECTORY |  na-apps/NA23_01_WebApp_-_ThermalCalcTool/
//
// AUTHOR    |  Noble Architecture
// DATE      |  2025-04-12
//
// DESCRIPTION
// - Provides calculation functions for U-Value determination
// - Implements ISO 6946:2017(E) calculation methods
// - Handles thermal resistance and transmittance calculations
//
// DEVELOPMENT LOG
// 1.0.0 - 2025-04-12 |  Initial Development
// - Basic calculation structure created
//
// =========================================================

// CONFIG | Constants for calculations
// ------------------------------------------------------------
const SURFACE_RESISTANCE = {
    INTERNAL: 0.13,  // m²K/W - Internal surface resistance (Rsi)
    EXTERNAL: 0.04   // m²K/W - External surface resistance (Rse)
};

// FUNCTION | Calculate R-value from thickness and lambda
// ------------------------------------------------------------
function calculateRValue(thickness, lambda) {
    // R = d/λ where d is thickness in meters and λ is thermal conductivity in W/(m·K)
    if (!thickness || !lambda || lambda === 0) {
        console.error("Invalid thickness or lambda value");
        return 0;
    }
    
    return thickness / lambda;
}

// FUNCTION | Calculate total R-value for a construction
// ------------------------------------------------------------
function calculateTotalRValue(layers) {
    // Total R-value is the sum of all layer R-values plus surface resistances
    let totalR = SURFACE_RESISTANCE.INTERNAL + SURFACE_RESISTANCE.EXTERNAL;
    
    layers.forEach(layer => {
        totalR += layer.rValue;
    });
    
    return totalR;
}

// FUNCTION | Calculate U-value from total R-value
// ------------------------------------------------------------
function calculateUValue(totalRValue) {
    // U = 1/R
    if (!totalRValue || totalRValue === 0) {
        console.error("Invalid total R-value");
        return 0;
    }
    
    return 1 / totalRValue;
}

// FUNCTION | Main calculation function for U-value
// ------------------------------------------------------------
function calculateConstructionUValue(layers) {
    // Calculate total R-value
    const totalRValue = calculateTotalRValue(layers);
    
    // Calculate U-value
    const uValue = calculateUValue(totalRValue);
    
    // Round to 2 decimal places
    return {
        totalRValue: parseFloat(totalRValue.toFixed(2)),
        uValue: parseFloat(uValue.toFixed(2))
    };
} 