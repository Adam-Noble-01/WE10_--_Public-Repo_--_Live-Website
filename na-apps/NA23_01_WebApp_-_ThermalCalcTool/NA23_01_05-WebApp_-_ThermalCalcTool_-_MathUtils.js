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
// 1.1.0 - 2025-04-18 |  ISO 6946 Compliance Update
// - Added advanced calculation methods for ISO 6946:2017(E) compliance
// - Implemented thermal bridge corrections
// - Added air gap correction calculations
//
// =========================================================

// CONFIG | Constants for calculations
// ------------------------------------------------------------
const SURFACE_RESISTANCE = {
    INTERNAL: 0.13,  // m²K/W - Internal surface resistance (Rsi)
    EXTERNAL: 0.04,  // m²K/W - External surface resistance (Rse)
    UNVENTILATED_AIR_LAYER: 0.18,  // m²K/W - Default for unventilated air layer (10-300mm)
    SLIGHTLY_VENTILATED: 0.08      // m²K/W - Default for slightly ventilated cavity
};

// Air cavity emissivity factors (Table 2 in ISO 6946)
const EMISSIVITY_FACTORS = {
    HIGH: 1.0,    // High emissivity (ε > 0.8)
    MEDIUM: 0.5,  // Medium emissivity (0.2 < ε < 0.8)
    LOW: 0.05     // Low emissivity (ε < 0.2)
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

// FUNCTION | Calculate R-value for an air cavity based on ISO 6946
// ------------------------------------------------------------
function calculateAirCavityRValue(thickness, direction, emissivity) {
    // thickness in mm, direction: "horizontal", "upward", or "downward", emissivity: surface emissivity
    
    // Convert thickness from mm to m
    const thicknessM = thickness / 1000;
    
    // Base values according to ISO 6946:2017 Table 2
    let baseR;
    
    if (thicknessM < 0.007) {
        // Air cavities less than 7mm
        if (direction === "horizontal") {
            baseR = 0.13;
        } else if (direction === "upward") {
            baseR = 0.10;
        } else { // downward
            baseR = 0.17;
        }
    } else if (thicknessM >= 0.007 && thicknessM < 0.025) {
        // Air cavities between 7mm and 25mm
        if (direction === "horizontal") {
            baseR = 0.18;
        } else if (direction === "upward") {
            baseR = 0.14;
        } else { // downward
            baseR = 0.21;
        }
    } else {
        // Air cavities 25mm or more
        if (direction === "horizontal") {
            baseR = 0.18;
        } else if (direction === "upward") {
            baseR = 0.14;
        } else { // downward
            baseR = 0.23;
        }
    }
    
    // Apply emissivity factor
    let emissivityFactor;
    if (emissivity < 0.2) {
        emissivityFactor = EMISSIVITY_FACTORS.LOW;
    } else if (emissivity < 0.8) {
        emissivityFactor = EMISSIVITY_FACTORS.MEDIUM;
    } else {
        emissivityFactor = EMISSIVITY_FACTORS.HIGH;
    }
    
    // Adjust R-value based on emissivity
    return baseR * emissivityFactor;
}

// FUNCTION | Calculate thermal bridge correction (ΔU") for mechanical fasteners (ISO 6946)
// ------------------------------------------------------------
function calculateThermalBridgeCorrection(fastenerConductivity, fastenerArea, fastenerLength, insulationRValue, totalArea) {
    // ΔU" = α * λf * Af * nf * (1/d0 - 1/d1)
    // where:
    // α = 0.8 (coefficient of thermal efficiency)
    // λf = thermal conductivity of fastener
    // Af = cross-sectional area of fastener
    // nf = number of fasteners per unit area
    // d0 = insulation layer thickness
    // d1 = length of fastener penetrating insulation
    
    const alpha = 0.8; // coefficient from ISO 6946
    const numberPerUnitArea = fastenerArea / totalArea;
    
    // Calculate correction for thermal transmittance
    const deltaU = alpha * fastenerConductivity * fastenerArea * numberPerUnitArea * (1 / insulationRValue);
    
    return deltaU;
}

// FUNCTION | Calculate upper limit of thermal resistance (maximum R)
// ------------------------------------------------------------
function calculateUpperLimitR(layers) {
    // Upper limit is calculated as if heat flow is one-dimensional
    let totalR = SURFACE_RESISTANCE.INTERNAL + SURFACE_RESISTANCE.EXTERNAL;
    
    layers.forEach(layer => {
        if (layer.isHomogeneous) {
            totalR += layer.rValue;
        } else {
            // For non-homogeneous layers, calculate weighted average R
            let sumR = 0;
            let sumFraction = 0;
            
            layer.components.forEach(component => {
                sumR += component.fraction * component.rValue;
                sumFraction += component.fraction;
            });
            
            // Ensure fractions add up to 1
            if (Math.abs(sumFraction - 1) > 0.001) {
                console.warn("Layer component fractions do not sum to 1");
            }
            
            totalR += sumR;
        }
    });
    
    return totalR;
}

// FUNCTION | Calculate lower limit of thermal resistance (minimum R)
// ------------------------------------------------------------
function calculateLowerLimitR(layers) {
    // Lower limit assumes parallel heat flow through each section
    let sections = [{ fraction: 1, rTotal: SURFACE_RESISTANCE.INTERNAL + SURFACE_RESISTANCE.EXTERNAL }];
    
    // Process each layer
    layers.forEach(layer => {
        if (layer.isHomogeneous) {
            // Add this homogeneous R-value to all sections
            sections.forEach(section => {
                section.rTotal += layer.rValue;
            });
        } else {
            // For non-homogeneous layers, create new sections
            let newSections = [];
            
            sections.forEach(existingSection => {
                layer.components.forEach(component => {
                    newSections.push({
                        fraction: existingSection.fraction * component.fraction,
                        rTotal: existingSection.rTotal + component.rValue
                    });
                });
            });
            
            sections = newSections;
        }
    });
    
    // Calculate total R-value (Lower limit)
    // R = 1 / (∑(fi/Ri))
    let sumFractionDividedByR = 0;
    sections.forEach(section => {
        sumFractionDividedByR += section.fraction / section.rTotal;
    });
    
    return 1 / sumFractionDividedByR;
}

// FUNCTION | Calculate combined R-value using ISO 6946 method
// ------------------------------------------------------------
function calculateCombinedRValue(layers) {
    // Calculate upper and lower limits
    const upperR = calculateUpperLimitR(layers);
    const lowerR = calculateLowerLimitR(layers);
    
    // Combined R-value is the average of upper and lower limits
    const combinedR = (upperR + lowerR) / 2;
    
    // Check if the calculation is valid (upper and lower limits within 20%)
    const maxDeviation = 0.2 * combinedR;
    if (Math.abs(upperR - lowerR) > maxDeviation) {
        console.warn("Warning: Upper and lower R-value limits differ by more than 20%. Consider a more detailed calculation method.");
    }
    
    return combinedR;
}

// FUNCTION | Apply air gap correction to R-value
// ------------------------------------------------------------
function applyAirGapCorrection(rValue, levelOfImperfection) {
    // Correction for air gaps according to ISO 6946:2017(E) Annex D
    // Level 0: No air gaps
    // Level 1: Minor gaps (ΔU" = 0.01)
    // Level 2: Moderate gaps (ΔU" = 0.04) 
    // Level 3: Major gaps (ΔU" = 0.09)
    
    let deltaU = 0;
    
    switch (levelOfImperfection) {
        case 0:
            deltaU = 0;
            break;
        case 1:
            deltaU = 0.01;
            break;
        case 2:
            deltaU = 0.04;
            break;
        case 3:
            deltaU = 0.09;
            break;
        default:
            console.error("Invalid level of imperfection");
            return rValue;
    }
    
    // Convert R-value to U-value, apply correction, then convert back
    const uValue = 1 / rValue;
    const correctedU = uValue + deltaU;
    return 1 / correctedU;
}

// FUNCTION | Apply rain water cooling correction for inverted roofs
// ------------------------------------------------------------
function applyRainWaterCoolingCorrection(uValue, averageRainfall, drainageFactor, thermalResistanceAboveWaterproofing) {
    // Correction for inverted roofs according to ISO 6946:2017(E) Annex F
    // p: average rainfall in mm/day during the heating season
    // f: drainage factor (typically between 0.5 and 1)
    // R1: thermal resistance above the waterproofing layer
    
    const x = 0.04; // factor given by the standard
    
    // Calculate correction ΔUr
    const deltaUr = x * averageRainfall * drainageFactor / thermalResistanceAboveWaterproofing;
    
    // Apply correction to U-value
    return uValue + deltaUr;
}

// FUNCTION | Main calculation function for U-value with all corrections
// ------------------------------------------------------------
function calculateConstructionUValue(layers, options = {}) {
    // Default options
    const defaultOptions = {
        includeThermalBridges: false,
        thermalBridges: [],
        includeAirGapCorrection: false,
        airGapLevel: 0,
        includeRainWaterCorrection: false,
        rainWaterParams: {
            averageRainfall: 0,
            drainageFactor: 0,
            thermalResistanceAboveWaterproofing: 0
        },
        totalArea: 1.0 // Default 1 m²
    };
    
    // Merge provided options with defaults
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Step 1: Calculate combined R-value
    let totalRValue;
    
    // Check if there are non-homogeneous layers
    const hasNonHomogeneousLayers = layers.some(layer => !layer.isHomogeneous);
    
    if (hasNonHomogeneousLayers) {
        totalRValue = calculateCombinedRValue(layers);
    } else {
        totalRValue = calculateTotalRValue(layers);
    }
    
    // Step 2: Apply air gap correction if needed
    if (mergedOptions.includeAirGapCorrection) {
        totalRValue = applyAirGapCorrection(totalRValue, mergedOptions.airGapLevel);
    }
    
    // Step 3: Calculate basic U-value
    let uValue = calculateUValue(totalRValue);
    
    // Step 4: Apply thermal bridge corrections if needed
    if (mergedOptions.includeThermalBridges && mergedOptions.thermalBridges.length > 0) {
        mergedOptions.thermalBridges.forEach(bridge => {
            const deltaU = calculateThermalBridgeCorrection(
                bridge.conductivity,
                bridge.area,
                bridge.length,
                bridge.insulationRValue,
                mergedOptions.totalArea
            );
            uValue += deltaU;
        });
    }
    
    // Step 5: Apply rain water cooling correction if needed
    if (mergedOptions.includeRainWaterCorrection) {
        const { averageRainfall, drainageFactor, thermalResistanceAboveWaterproofing } = mergedOptions.rainWaterParams;
        uValue = applyRainWaterCoolingCorrection(
            uValue,
            averageRainfall,
            drainageFactor,
            thermalResistanceAboveWaterproofing
        );
    }
    
    // Return results rounded to 2 decimal places
    return {
        totalRValue: parseFloat(totalRValue.toFixed(2)),
        uValue: parseFloat(uValue.toFixed(2))
    };
}

// Export functions for use in other modules
// ------------------------------------------------------------
export {
    calculateRValue,
    calculateTotalRValue,
    calculateUValue,
    calculateAirCavityRValue,
    calculateThermalBridgeCorrection,
    calculateUpperLimitR,
    calculateLowerLimitR,
    calculateCombinedRValue,
    applyAirGapCorrection,
    applyRainWaterCoolingCorrection,
    calculateConstructionUValue
}; 