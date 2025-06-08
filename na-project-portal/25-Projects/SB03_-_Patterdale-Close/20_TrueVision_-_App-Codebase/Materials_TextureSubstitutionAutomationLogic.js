// =============================================================================
// VALEDESIGNSUITE - TRUEVISION 3D MATERIAL SUBSTITUTION AUTOMATION LOGIC
// =============================================================================
//
// FILE       : Materials_TextureSubstitutionAutomationLogic.js
// NAMESPACE  : TrueVision3D.MaterialLogic
// MODULE     : Material Substitution and Enhancement
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : JSON-driven material substitution system for GLB imports
// CREATED    : 2025
//
// DESCRIPTION:
// - This module provides comprehensive JSON-driven material substitution for imported GLB files.
// - Maps ALL possible parameters from the JSON index as the single source of truth.
// - Supports both range-based and specific material code matching for all 25+ categories.
// - Handles advanced PBR features including clearcoat, subsurface, anisotropy, and sheen.
// - Includes robust error handling, validation, and comprehensive logging.
// - Manages texture loading, HDRI integration, and transparency configuration.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 2025-01-14 - Version 2.0.0
// - Complete rewrite for comprehensive JSON parameter mapping
// - Added support for ALL 25+ material categories from JSON index
// - Implemented advanced PBR features (clearcoat, subsurface, anisotropy, sheen)
// - Added comprehensive texture loading and validation system
// - Enhanced error handling and diagnostic logging throughout
// - JSON is now the single source of truth for ALL material properties
//
// =============================================================================

// Ensure TrueVision3D namespace exists
window.TrueVision3D = window.TrueVision3D || {};
window.TrueVision3D.MaterialLogic = (function() {
    'use strict';

    // MODULE VARIABLES | Core Babylon.js Scene Object and Material Data
    // ------------------------------------------------------------
    let scene                     = null;                                      // <-- Babylon.js scene instance
    let materialSubstitutionData  = null;                                      // <-- Loaded JSON configuration data
    let materialRanges            = [];                                        // <-- Parsed material category ranges
    let specificMaterials         = {};                                        // <-- Map of specific material codes to configs
    let categoryDefaults          = {};                                        // <-- Default configurations per category
    let isInitialized             = false;                                     // <-- Initialization state flag
    let loadingPromise            = null;                                      // <-- Promise for data loading
    // ---------------------------------------------------------------

    // MODULE VARIABLES | Processing Statistics and Diagnostics
    // ------------------------------------------------------------
    let processingStats           = {                                          // <-- Material processing statistics
        totalMaterialsFound       : 0,
        materialsWithCodes        : 0,
        specificMatches           : 0,
        rangeMatches              : 0,
        substitutionsApplied      : 0,
        substitutionsFailed       : 0,
        categoriesMatched         : {},
        failureReasons            : []
    };
    // ---------------------------------------------------------------

    // -----------------------------------------------------------------------------
    // REGION | Comprehensive Material Category Default Configurations
    // -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Complete Category Default Mapping
    // ------------------------------------------------------------
    const CATEGORY_DEFAULTS = {
        "3dHelpers": {
            AlbedoColor: "#FF00FF",                                            // <-- Magenta helper color
            Metallic: 0.0,
            Roughness: 1.0,                                                    // <-- Keep at 1.0 for helpers
            Alpha: 0.5,
            EmissiveColor: "#FF00FF"
        },
        "Generic": {
            AlbedoColor: "#CCCCCC",                                            // <-- Neutral grey
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.7 to 0.9
            Alpha: 1.0
        },
        "Paint_Colours": {
            AlbedoColor: "#FFFFFF",                                            // <-- White base for color variation
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.4 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.9
        },
        "Wood": {
            AlbedoColor: "#8B4513",                                            // <-- Natural wood brown
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.8 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.7
        },
        "Glass": {
            AlbedoColor: "#FFFFFF",                                            // <-- Clear glass
            Metallic: 0.0,
            Roughness: 0.1,                                                    // <-- Keep low for glass transparency
            Alpha: 0.1,
            UseRadianceOverAlpha: true,
            UseSpecularOverAlpha: true,
            ReflectivityColor: "#FFFFFF",
            MicroSurface: 0.95
        },
        "Plastic": {
            AlbedoColor: "#FFFFFF",                                            // <-- White plastic base
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.6 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.85
        },
        "Metal": {
            AlbedoColor: "#CCCCCC",                                            // <-- Metallic grey
            Metallic: 1.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.3 to 0.9 for matte metal
            Alpha: 1.0,
            ReflectivityColor: "#FFFFFF",
            MicroSurface: 0.9
        },
        "Concrete": {
            AlbedoColor: "#A0A0A0",                                            // <-- Concrete grey
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Already at 0.9
            Alpha: 1.0,
            MicroSurface: 0.5
        },
        "Brick": {
            AlbedoColor: "#B85450",                                            // <-- Brick red
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.85 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.6
        },
        "Stone": {
            AlbedoColor: "#8F8F8F",                                            // <-- Stone grey
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Already at 0.9
            Alpha: 1.0,
            MicroSurface: 0.4
        },
        "Roofing": {
            AlbedoColor: "#654321",                                            // <-- Roof tile brown
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.8 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.6
        },
        "Fabrics": {
            AlbedoColor: "#E6E6FA",                                            // <-- Fabric lavender
            Metallic: 0.0,
            Roughness: 0.95,                                                   // <-- Already high at 0.95
            Alpha: 1.0,
            MicroSurface: 0.3
        },
        "Flooring": {
            AlbedoColor: "#DEB887",                                            // <-- Flooring beige
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.7 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.8
        },
        "FloorTiles": {
            AlbedoColor: "#F5F5DC",                                            // <-- Tile beige
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.3 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.9
        },
        "WallTiles": {
            AlbedoColor: "#FFFFFF",                                            // <-- White wall tiles
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.2 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.95
        },
        "Mirrors": {
            AlbedoColor: "#F8F8FF",                                            // <-- Mirror silver
            Metallic: 1.0,
            Roughness: 0.05,                                                   // <-- Keep low for mirror reflectivity
            Alpha: 1.0,
            ReflectivityColor: "#FFFFFF",
            MicroSurface: 0.99
        },
        "Windows": {
            AlbedoColor: "#FFFFFF",                                            // <-- Window glass
            Metallic: 0.0,
            Roughness: 0.1,                                                    // <-- Keep low for window transparency
            Alpha: 0.2,
            UseRadianceOverAlpha: true,
            UseSpecularOverAlpha: true,
            ReflectivityColor: "#FFFFFF",
            MicroSurface: 0.95
        },
        "Doors": {
            AlbedoColor: "#8B4513",                                            // <-- Door wood brown
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.6 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.8
        },
        "Furniture": {
            AlbedoColor: "#DEB887",                                            // <-- Furniture beige
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.6 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.8
        },
        "Lighting": {
            AlbedoColor: "#FFFACD",                                            // <-- Light cream
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.4 to 0.9
            Alpha: 1.0,
            EmissiveColor: "#FFFACD",
            MicroSurface: 0.9
        },
        "Electrical": {
            AlbedoColor: "#FFFFFF",                                            // <-- Electrical white
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.5 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.85
        },
        "Paving": {
            AlbedoColor: "#708090",                                            // <-- Paving slate grey
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.8 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.5
        },
        "NaturalLandscape": {
            AlbedoColor: "#8FBC8F",                                            // <-- Natural green
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Already at 0.9
            Alpha: 1.0,
            MicroSurface: 0.3
        },
        "Vegetation": {
            AlbedoColor: "#228B22",                                            // <-- Vegetation green
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Already at 0.9
            Alpha: 1.0,
            MicroSurface: 0.2
        },
        "Other": {
            AlbedoColor: "#D3D3D3",                                            // <-- Light grey default
            Metallic: 0.0,
            Roughness: 0.9,                                                    // <-- Changed from 0.7 to 0.9
            Alpha: 1.0,
            MicroSurface: 0.7
        }
    };
    // ---------------------------------------------------------------

    // endregion -------------------------------------------------------------------

    // -----------------------------------------------------------------------------
    // REGION | Initialization and Data Loading System
    // -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Material Logic Module with Robust Loading
    // ------------------------------------------------------------
    async function initialize(babylonScene) {
        try {
            console.log("Material Logic module initializing...");
            scene = babylonScene;                                              // Store scene reference
            
            // PREVENT MULTIPLE INITIALIZATION ATTEMPTS
            if (loadingPromise) {
                console.log("Material data already loading, waiting for completion...");
                await loadingPromise;                                          // Wait for existing load
                return isInitialized;
            }
            
            // START LOADING PROCESS
            loadingPromise = loadMaterialSubstitutionData();                   // Create loading promise
            const success = await loadingPromise;                             // Wait for completion
            
            if (success) {
                isInitialized = true;                                          // Mark as initialized
                console.log("Material Logic module initialized successfully");
                logInitializationSummary();                                    // Log initialization details
            } else {
                console.error("Material Logic module initialization failed");
            }
            
            return isInitialized;                                              // Return success state
            
        } catch (error) {
            console.error("Material Logic initialization error:", error);     // Log error
            isInitialized = false;                                            // Mark as failed
            return false;
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Load and Parse Material Substitution JSON Data
    // ---------------------------------------------------------------
    async function loadMaterialSubstitutionData() {
        try {
            console.log("Loading material substitution data...");
            
            // FETCH JSON CONFIGURATION FILE
            const response = await fetch('Data_-_PbrTextureMaterialSubstituteIndex.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // PARSE JSON DATA
            materialSubstitutionData = await response.json();                  // Parse JSON response
            
            // VALIDATE JSON STRUCTURE
            if (!validateJSONStructure(materialSubstitutionData)) {
                throw new Error("Invalid JSON structure in material substitution data");
            }
            
            // PARSE CONFIGURATION COMPONENTS
            const parseSuccess = parseMaterialConfiguration();                 // Parse all configuration data
            
            if (parseSuccess) {
                console.log("Material substitution data loaded and parsed successfully");
                return true;
            } else {
                console.error("Failed to parse material configuration data");
                return false;
            }
            
        } catch (error) {
            console.error("Failed to load material substitution data:", error);
            return false;
        }
    }
    // ---------------------------------------------------------------

    // REGION | Enhanced JSON Validation and Error Handling
    // -----------------------------------------------------------------------------

    // ENHANCED FUNCTION | Validate JSON Structure with Deep Validation
    // ---------------------------------------------------------------
    function validateJSONStructure(data) {
        // VALIDATE TOP-LEVEL STRUCTURE
        const requiredFields = ['Material_CategoryIndex', 'materials'];       // Required top-level fields
        
        for (const field of requiredFields) {
            if (!data[field]) {
                console.error(`Missing required field: ${field}`);
                return false;
            }
        }
        
        // VALIDATE MATERIALS ARRAY STRUCTURE
        if (!Array.isArray(data.materials)) {
            console.error("Materials field must be an array");
            return false;
        }
        
        // VALIDATE MATERIAL CATEGORY INDEX STRUCTURE
        if (typeof data.Material_CategoryIndex !== 'object') {
            console.error("Material_CategoryIndex must be an object");
            return false;
        }
        
        // VALIDATE INDIVIDUAL MATERIAL ENTRIES
        const materialValidationErrors = [];                                   // <-- Track validation errors
        
        data.materials.forEach((material, index) => {
            const errors = validateMaterialEntry(material, index);             // <-- Validate each material
            materialValidationErrors.push(...errors);                         // <-- Collect errors
        });
        
        // LOG VALIDATION WARNINGS
        if (materialValidationErrors.length > 0) {
            console.warn("Material validation warnings:", materialValidationErrors);
            // Continue execution but log issues
        }
        
        console.log("JSON structure validation completed");
        return true;                                                           // <-- Return success even with warnings
    }
    // ---------------------------------------------------------------

    // NEW HELPER FUNCTION | Validate Individual Material Entry
    // ---------------------------------------------------------------
    function validateMaterialEntry(material, index) {
        const errors = [];                                                     // <-- Error collection array
        
        // VALIDATE REQUIRED FIELDS
        if (!material.UniqueIndexMaterialCode) {
            errors.push(`Material at index ${index}: Missing UniqueIndexMaterialCode`);
        }
        
        // VALIDATE MATERIAL CODE FORMAT
        if (material.UniqueIndexMaterialCode && 
            !/^MAT\d{5}$/.test(material.UniqueIndexMaterialCode)) {
            errors.push(`Material at index ${index}: Invalid material code format: ${material.UniqueIndexMaterialCode}`);
        }
        
        // VALIDATE NUMERIC PROPERTIES WITH RANGES
        const numericValidations = [
            { prop: 'Metallic', min: 0.0, max: 1.0 },
            { prop: 'Roughness', min: 0.0, max: 1.0 },
            { prop: 'Alpha', min: 0.0, max: 1.0 },
            { prop: 'MicroSurface', min: 0.0, max: 1.0 },
            { prop: 'AmbientTextureStrength', min: 0.0, max: 10.0 }
        ];
        
        numericValidations.forEach(validation => {
            if (material[validation.prop] !== undefined) {
                const value = parseFloat(material[validation.prop]);          // <-- Parse numeric value
                if (isNaN(value) || value < validation.min || value > validation.max) {
                    errors.push(`Material at index ${index}: ${validation.prop} value ${material[validation.prop]} out of range [${validation.min}, ${validation.max}]`);
                }
            }
        });
        
        // VALIDATE COLOR FORMAT
        const colorProps = ['AlbedoColor', 'EmissiveColor', 'ReflectivityColor'];
        colorProps.forEach(prop => {
            if (material[prop] && material[prop] !== "nil") {
                if (!/^#[0-9A-Fa-f]{6}$/.test(material[prop])) {
                    errors.push(`Material at index ${index}: Invalid color format for ${prop}: ${material[prop]}`);
                }
            }
        });
        
        return errors;                                                         // <-- Return validation errors
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Parse All Material Configuration Components
    // ---------------------------------------------------------------
    function parseMaterialConfiguration() {
        try {
            // RESET PARSING STATE
            materialRanges = [];                                               // Clear ranges array
            specificMaterials = {};                                            // Clear specific materials
            categoryDefaults = { ...CATEGORY_DEFAULTS };                       // Copy default configurations
            
            // PARSE CONFIGURATION COMPONENTS
            const rangesParsed = parseMaterialRanges();                        // Parse category ranges
            const specificParsed = parseSpecificMaterials();                   // Parse specific materials
            
            return rangesParsed && specificParsed;                            // Return success state
            
        } catch (error) {
            console.error("Error parsing material configuration:", error);
            return false;
        }
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Parse Material Category Ranges from JSON
    // ---------------------------------------------------------------
    function parseMaterialRanges() {
        try {
            const categoryIndex = materialSubstitutionData.Material_CategoryIndex;
            let rangesParsed = 0;                                              // Counter for parsed ranges
            
            // ITERATE THROUGH ALL CATEGORY KEYS
            Object.keys(categoryIndex).forEach(key => {
                // SKIP NON-CATEGORY ENTRIES
                if (!key.startsWith("MatCatID_") || 
                    key.includes("Notes") || 
                    key.includes("Usage")) {
                    return;
                }
                
                const rangeString = categoryIndex[key];                        // Get range string
                const match = rangeString.match(/MAT(\d{5})\s*-\s*MAT(\d{5})/); // Extract range numbers
                
                if (match) {
                    const categoryName = key.replace("MatCatID_", "");          // Extract category name
                    const rangeConfig = {
                        category: categoryName,                                 // Category name
                        start: parseInt(match[1]),                              // Range start
                        end: parseInt(match[2]),                                // Range end
                        rangeString: rangeString                                // Original range string
                    };
                    
                    materialRanges.push(rangeConfig);                          // Store range configuration
                    rangesParsed++;                                            // Increment counter
                    
                    console.log(`Parsed range: ${categoryName} (${rangeString})`);
                }
            });
            
            console.log(`Material ranges parsed: ${rangesParsed} categories`);
            return rangesParsed > 0;                                           // Return success if any ranges parsed
            
        } catch (error) {
            console.error("Error parsing material ranges:", error);
            return false;
        }
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Parse Specific Material Configurations from JSON
    // ---------------------------------------------------------------
    function parseSpecificMaterials() {
        try {
            let specificParsed = 0;                                            // Counter for parsed materials
            
            // ITERATE THROUGH MATERIALS ARRAY
            materialSubstitutionData.materials.forEach((material, index) => {
                // VALIDATE REQUIRED FIELDS
                if (!material.UniqueIndexMaterialCode) {
                    console.warn(`Material at index ${index} missing UniqueIndexMaterialCode`);
                    return;
                }
                
                const code = material.UniqueIndexMaterialCode;                 // Get material code
                specificMaterials[code] = material;                            // Store material configuration
                specificParsed++;                                              // Increment counter
                
                console.log(`Parsed specific material: ${code} (${material.VerboseName || 'Unnamed'})`);
            });
            
            console.log(`Specific materials parsed: ${specificParsed} materials`);
            return specificParsed >= 0;                                        // Return success (allow zero)
            
        } catch (error) {
            console.error("Error parsing specific materials:", error);
            return false;
        }
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Log Initialization Summary and Statistics
    // ---------------------------------------------------------------
    function logInitializationSummary() {
        console.log("=== Material Logic Initialization Summary ===");
        console.log(`Material ranges loaded: ${materialRanges.length}`);
        console.log(`Specific materials loaded: ${Object.keys(specificMaterials).length}`);
        console.log(`Category defaults available: ${Object.keys(categoryDefaults).length}`);
        console.log("Material categories:", materialRanges.map(r => r.category).join(', '));
        console.log("============================================");
    }
    // ---------------------------------------------------------------

    // endregion -------------------------------------------------------------------

    // -----------------------------------------------------------------------------
    // REGION | Material Code Extraction and Configuration Matching
    // -----------------------------------------------------------------------------

    // HELPER FUNCTION | Extract Material Code from Name with Validation
    // ---------------------------------------------------------------
    function extractMaterialCode(materialName) {
        if (!materialName || typeof materialName !== 'string') {
            return null;                                                       // Return null for invalid input
        }
        
        const match = materialName.match(/MAT(\d{5})/);                        // Match MAT##### pattern
        const code = match ? "MAT" + match[1] : null;                         // Extract code or null
        
        if (code) {
            console.log(`Extracted material code: ${code} from name: ${materialName}`);
        }
        
        return code;                                                           // Return extracted code
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Find Complete Material Configuration by Code
    // ---------------------------------------------------------------
    function findMaterialConfiguration(materialCode) {
        if (!materialCode || !isInitialized) {
            return null;                                                       // Exit if no code or not initialized
        }
        
        // CHECK FOR SPECIFIC MATERIAL MATCH FIRST (HIGHEST PRIORITY)
        if (specificMaterials[materialCode]) {
            console.log(`Found specific material configuration for: ${materialCode}`);
            return specificMaterials[materialCode];                            // Return specific configuration
        }
        
        // CHECK FOR RANGE MATCH (FALLBACK TO CATEGORY DEFAULTS)
        const rangeConfig = findRangeConfiguration(materialCode);              // Find matching range
        if (rangeConfig) {
            console.log(`Using range configuration for: ${materialCode} in category: ${rangeConfig.category}`);
            return createRangeConfiguration(rangeConfig.category, materialCode); // Create range-based config
        }
        
        console.warn(`No configuration found for material code: ${materialCode}`);
        return null;                                                           // No match found
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Find Range Configuration for Material Code
    // ---------------------------------------------------------------
    function findRangeConfiguration(materialCode) {
        const codeNumber = parseInt(materialCode.substring(3));                // Extract numeric part
        
        // ITERATE THROUGH ALL RANGE CONFIGURATIONS
        for (const range of materialRanges) {
            if (codeNumber >= range.start && codeNumber <= range.end) {        // Check if code in range
                return range;                                                  // Return matching range
            }
        }
        
        return null;                                                           // No range match found
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Create Range-Based Configuration with Defaults
    // ---------------------------------------------------------------
    function createRangeConfiguration(category, materialCode) {
        // GET CATEGORY DEFAULTS
        const defaults = categoryDefaults[category] || categoryDefaults["Other"]; // Use category or fallback
        
        // CREATE CONFIGURATION OBJECT WITH METADATA
        const config = {
            ...defaults,                                                       // Copy default properties
            UniqueIndexMaterialCode: materialCode,                             // Set material code
            VerboseName: `Generated_${category}_${materialCode}`,              // Generate name
            isRangeGenerated: true,                                            // Mark as range-generated
            sourceCategory: category                                           // Store source category
        };
        
        return config;                                                         // Return generated configuration
    }
    // ---------------------------------------------------------------

    // endregion -------------------------------------------------------------------

    // -----------------------------------------------------------------------------
    // REGION | Comprehensive PBR Material Property Application System
    // -----------------------------------------------------------------------------

    // FUNCTION | Apply Complete Material Configuration to PBR Material
    // ---------------------------------------------------------------
    function applyMaterialConfiguration(pbrMaterial, config, materialName) {
        if (!config || !pbrMaterial) {
            console.warn(`Cannot apply configuration: missing config or material for ${materialName}`);
            return false;
        }
        
        try {
            // APPLY BASIC PBR PROPERTIES
            applyBasicPBRProperties(pbrMaterial, config);                      // Apply core PBR settings
            
            // APPLY TEXTURE PROPERTIES
            applyTextureProperties(pbrMaterial, config);                       // Apply texture mappings
            
            // APPLY ADVANCED PBR FEATURES
            applyAdvancedPBRFeatures(pbrMaterial, config);                     // Apply advanced features
            
            // APPLY ENVIRONMENT AND REFLECTION SETTINGS
            applyEnvironmentSettings(pbrMaterial, config);                     // Apply environment settings
            
            // LOG SUCCESSFUL APPLICATION
            console.log(`Applied complete material configuration to: ${materialName}`);
            return true;
            
        } catch (error) {
            console.error(`Error applying material configuration to ${materialName}:`, error);
            return false;
        }
    }
    // ---------------------------------------------------------------

    // ENHANCED FUNCTION | Safe Property Application with Type Validation
    // ---------------------------------------------------------------
    function applyBasicPBRProperties(pbrMaterial, config) {
        // SAFE ALBEDO COLOR APPLICATION
        if (config.AlbedoColor && config.AlbedoColor !== "nil") {
            const color = hexToColor3(config.AlbedoColor);                     // <-- Convert with validation
            if (color) {
                pbrMaterial.albedoColor = color;                               // <-- Apply only if valid
            }
        }
        
        // SAFE NUMERIC PROPERTY APPLICATION WITH CLAMPING
        const numericProps = [
            { source: 'Metallic', target: 'metallic', min: 0.0, max: 1.0 },
            { source: 'Roughness', target: 'roughness', min: 0.0, max: 1.0 },
            { source: 'MicroSurface', target: 'microSurface', min: 0.0, max: 1.0 }
        ];
        
        numericProps.forEach(prop => {
            if (config[prop.source] !== undefined) {
                const value = safeParseFloat(config[prop.source], prop.min, prop.max); // <-- Safe parsing with clamping
                if (value !== null) {
                    pbrMaterial[prop.target] = value;                          // <-- Apply clamped value
                }
            }
        });
        
        // SAFE ALPHA APPLICATION WITH TRANSPARENCY MODE
        if (config.Alpha !== undefined) {
            const alpha = safeParseFloat(config.Alpha, 0.0, 1.0);             // <-- Clamp alpha to valid range
            if (alpha !== null) {
                pbrMaterial.alpha = alpha;                                     // <-- Apply alpha
                
                // CONFIGURE TRANSPARENCY MODE SAFELY
                if (alpha < 1.0 && BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND) {
                    pbrMaterial.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
                }
            }
        }
        
        // SAFE EMISSIVE COLOR APPLICATION
        if (config.EmissiveColor && config.EmissiveColor !== "nil") {
            const emissiveColor = hexToColor3(config.EmissiveColor);           // <-- Convert with validation
            if (emissiveColor) {
                pbrMaterial.emissiveColor = emissiveColor;                     // <-- Apply only if valid
            }
        }
        
        // SAFE REFLECTIVITY COLOR APPLICATION
        if (config.ReflectivityColor && config.ReflectivityColor !== "nil") {
            const reflectivityColor = hexToColor3(config.ReflectivityColor);   // <-- Convert with validation
            if (reflectivityColor) {
                pbrMaterial.reflectivityColor = reflectivityColor;             // <-- Apply only if valid
            }
        }
    }
    // ---------------------------------------------------------------

    // NEW HELPER FUNCTION | Safe Float Parsing with Range Clamping
    // ---------------------------------------------------------------
    function safeParseFloat(value, min = -Infinity, max = Infinity) {
        try {
            if (value === null || value === undefined || value === "nil") {
                return null;                                                   // <-- Return null for invalid input
            }
            
            const parsed = parseFloat(value);                                  // <-- Parse the value
            
            if (isNaN(parsed)) {
                console.warn(`Invalid numeric value: ${value}, skipping`);
                return null;                                                   // <-- Return null for NaN
            }
            
            const clamped = Math.max(min, Math.min(max, parsed));              // <-- Clamp to valid range
            
            if (clamped !== parsed) {
                console.warn(`Value ${parsed} clamped to ${clamped} (range: ${min} - ${max})`);
            }
            
            return clamped;                                                    // <-- Return clamped value
            
        } catch (error) {
            console.error(`Error parsing float value ${value}:`, error);
            return null;                                                       // <-- Return null on error
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Apply Texture Properties from Configuration
    // ---------------------------------------------------------------
    function applyTextureProperties(pbrMaterial, config) {
        // APPLY ALBEDO TEXTURE
        if (config.AlbedoTexture && config.AlbedoTexture !== "nil") {
            pbrMaterial.albedoTexture = loadTexture(config.AlbedoTexture);     // Load and apply albedo texture
        }
        
        // APPLY NORMAL TEXTURE
        if (config.NormalTexture && config.NormalTexture !== "nil") {
            pbrMaterial.bumpTexture = loadTexture(config.NormalTexture);       // Load and apply normal texture
            
            // APPLY NORMAL MAP STRENGTH
            if (config.NormalMapStrength !== undefined) {
                pbrMaterial.bumpTexture.level = parseFloat(config.NormalMapStrength);  // Control normal intensity
            }
            
            // APPLY NORMAL MAP INVERSION SETTINGS
            if (config.InvertNormalMapX !== undefined) {
                pbrMaterial.invertNormalMapX = config.InvertNormalMapX;        // Apply X inversion
            }
            if (config.InvertNormalMapY !== undefined) {
                pbrMaterial.invertNormalMapY = config.InvertNormalMapY;        // Apply Y inversion
            }
        }
        
        // APPLY METALLIC TEXTURE (COMBINED ORM)
        if (config.MetallicTexture && config.MetallicTexture !== "nil") {
            pbrMaterial.metallicTexture = loadTexture(config.MetallicTexture); // Load metallic texture
        }
        
        // APPLY AMBIENT OCCLUSION TEXTURE
        if (config.AmbientTexture && config.AmbientTexture !== "nil") {
            pbrMaterial.ambientTexture = loadTexture(config.AmbientTexture);   // Load AO texture
            
            if (config.AmbientTextureStrength !== undefined) {
                pbrMaterial.ambientTextureStrength = parseFloat(config.AmbientTextureStrength);
            }
        }
        
        // APPLY EMISSIVE TEXTURE
        if (config.EmissiveTexture && config.EmissiveTexture !== "nil") {
            pbrMaterial.emissiveTexture = loadTexture(config.EmissiveTexture); // Load emissive texture
        }
        
        // APPLY OPACITY TEXTURE
        if (config.OpacityTexture && config.OpacityTexture !== "nil") {
            pbrMaterial.opacityTexture = loadTexture(config.OpacityTexture);   // Load opacity texture
        }
        
        // APPLY REFLECTION TEXTURE
        if (config.ReflectionTexture && config.ReflectionTexture !== "nil") {
            pbrMaterial.reflectionTexture = loadTexture(config.ReflectionTexture);
        }
        
        // APPLY REFLECTIVITY TEXTURE
        if (config.ReflectivityTexture && config.ReflectivityTexture !== "nil") {
            pbrMaterial.reflectivityTexture = loadTexture(config.ReflectivityTexture);
        }
        
        // APPLY MICROSURFACE TEXTURE
        if (config.MicroSurfaceTexture && config.MicroSurfaceTexture !== "nil") {
            pbrMaterial.microSurfaceTexture = loadTexture(config.MicroSurfaceTexture);
        }
    }
    // ---------------------------------------------------------------

    // ENHANCED FUNCTION | Robust Advanced PBR Features with Existence Checks
    // ---------------------------------------------------------------
    function applyAdvancedPBRFeatures(pbrMaterial, config) {
        // SAFE CLEAR COAT APPLICATION
        if (config.ClearCoat_isEnabled && pbrMaterial.clearCoat) {            // <-- Check if clearCoat exists
            try {
                pbrMaterial.clearCoat.isEnabled = true;                       // <-- Enable clear coat
                
                if (config.ClearCoat_intensity !== undefined) {
                    const intensity = safeParseFloat(config.ClearCoat_intensity, 0.0, 1.0);
                    if (intensity !== null) {
                        pbrMaterial.clearCoat.intensity = intensity;          // <-- Apply clamped intensity
                    }
                }
                
                if (config.ClearCoat_roughness !== undefined) {
                    const roughness = safeParseFloat(config.ClearCoat_roughness, 0.0, 1.0);
                    if (roughness !== null) {
                        pbrMaterial.clearCoat.roughness = roughness;          // <-- Apply clamped roughness
                    }
                }
                
                // SAFE TEXTURE APPLICATION
                if (config.ClearCoat_texture && config.ClearCoat_texture !== "nil") {
                    const texture = loadTexture(config.ClearCoat_texture);    // <-- Load with error handling
                    if (texture) {
                        pbrMaterial.clearCoat.texture = texture;              // <-- Apply only if loaded
                    }
                }
                
                if (config.ClearCoat_bumpTexture && config.ClearCoat_bumpTexture !== "nil") {
                    const bumpTexture = loadTexture(config.ClearCoat_bumpTexture);
                    if (bumpTexture) {
                        pbrMaterial.clearCoat.bumpTexture = bumpTexture;      // <-- Apply only if loaded
                    }
                }
                
            } catch (error) {
                console.error("Error applying clear coat features:", error);   // <-- Log clear coat errors
            }
        }
        
        // SAFE SUBSURFACE APPLICATION
        if (config.SubSurface_isRefractionEnabled && pbrMaterial.subSurface) { // <-- Check if subSurface exists
            try {
                pbrMaterial.subSurface.isRefractionEnabled = true;            // <-- Enable refraction
                
                if (config.SubSurface_indexOfRefraction !== undefined) {
                    const ior = safeParseFloat(config.SubSurface_indexOfRefraction, 1.0, 3.0);
                    if (ior !== null) {
                        pbrMaterial.subSurface.indexOfRefraction = ior;       // <-- Apply clamped IOR
                    }
                }
                
                if (config.SubSurface_tintColor && config.SubSurface_tintColor !== "nil") {
                    const tintColor = hexToColor3(config.SubSurface_tintColor);
                    if (tintColor) {
                        pbrMaterial.subSurface.tintColor = tintColor;         // <-- Apply validated color
                    }
                }
                
                if (config.SubSurface_translucencyIntensity !== undefined) {
                    const intensity = safeParseFloat(config.SubSurface_translucencyIntensity, 0.0, 1.0);
                    if (intensity !== null) {
                        pbrMaterial.subSurface.translucencyIntensity = intensity;
                    }
                }
                
            } catch (error) {
                console.error("Error applying subsurface features:", error);   // <-- Log subsurface errors
            }
        }
        
        // SAFE ANISOTROPY APPLICATION
        if (config.Anisotropy_isEnabled && pbrMaterial.anisotropy) {          // <-- Check if anisotropy exists
            try {
                pbrMaterial.anisotropy.isEnabled = true;                      // <-- Enable anisotropy
                
                if (config.Anisotropy_intensity !== undefined) {
                    const intensity = safeParseFloat(config.Anisotropy_intensity, 0.0, 1.0);
                    if (intensity !== null) {
                        pbrMaterial.anisotropy.intensity = intensity;         // <-- Apply clamped intensity
                    }
                }
                
                // SAFE DIRECTION VECTOR APPLICATION
                if (config.Anisotropy_direction && Array.isArray(config.Anisotropy_direction) && 
                    config.Anisotropy_direction.length >= 2) {
                    const x = safeParseFloat(config.Anisotropy_direction[0], -1.0, 1.0);
                    const y = safeParseFloat(config.Anisotropy_direction[1], -1.0, 1.0);
                    
                    if (x !== null && y !== null && pbrMaterial.anisotropy.direction) {
                        pbrMaterial.anisotropy.direction.x = x;               // <-- Apply validated X
                        pbrMaterial.anisotropy.direction.y = y;               // <-- Apply validated Y
                    }
                }
                
                if (config.Anisotropy_texture && config.Anisotropy_texture !== "nil") {
                    const texture = loadTexture(config.Anisotropy_texture);
                    if (texture) {
                        pbrMaterial.anisotropy.texture = texture;             // <-- Apply only if loaded
                    }
                }
                
            } catch (error) {
                console.error("Error applying anisotropy features:", error);   // <-- Log anisotropy errors
            }
        }
        
        // SAFE SHEEN APPLICATION
        if (config.Sheen_isEnabled && pbrMaterial.sheen) {                    // <-- Check if sheen exists
            try {
                pbrMaterial.sheen.isEnabled = true;                           // <-- Enable sheen
                
                if (config.Sheen_intensity !== undefined) {
                    const intensity = safeParseFloat(config.Sheen_intensity, 0.0, 1.0);
                    if (intensity !== null) {
                        pbrMaterial.sheen.intensity = intensity;              // <-- Apply clamped intensity
                    }
                }
                
                if (config.Sheen_color && config.Sheen_color !== "nil") {
                    const sheenColor = hexToColor3(config.Sheen_color);
                    if (sheenColor) {
                        pbrMaterial.sheen.color = sheenColor;                 // <-- Apply validated color
                    }
                }
                
                if (config.Sheen_texture && config.Sheen_texture !== "nil") {
                    const texture = loadTexture(config.Sheen_texture);
                    if (texture) {
                        pbrMaterial.sheen.texture = texture;                  // <-- Apply only if loaded
                    }
                }
                
            } catch (error) {
                console.error("Error applying sheen features:", error);        // <-- Log sheen errors
            }
        }
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Apply Environment and Reflection Settings
    // ---------------------------------------------------------------
    function applyEnvironmentSettings(pbrMaterial, config) {
        // APPLY ALPHA HANDLING SETTINGS
        if (config.UseRadianceOverAlpha !== undefined) {
            pbrMaterial.useRadianceOverAlpha = config.UseRadianceOverAlpha;    // Apply radiance over alpha
        }
        if (config.UseSpecularOverAlpha !== undefined) {
            pbrMaterial.useSpecularOverAlpha = config.UseSpecularOverAlpha;    // Apply specular over alpha
        }
        if (config.UseAlphaFromAlbedoTexture !== undefined) {
            pbrMaterial.useAlphaFromAlbedoTexture = config.UseAlphaFromAlbedoTexture;
        }
        
        // APPLY ENVIRONMENT TEXTURE SETTINGS
        if (config.EnvironmentTexture && config.EnvironmentTexture !== "nil") {
            // Note: Environment texture typically set at scene level
            console.log(`Environment texture specified: ${config.EnvironmentTexture}`);
        }
    }
    // ---------------------------------------------------------------

    // ENHANCED FUNCTION | Robust Texture Loading with Retry Logic
    // ---------------------------------------------------------------
    function loadTexture(texturePath) {
        try {
            if (!texturePath || texturePath === "nil" || typeof texturePath !== 'string') {
                return null;                                                   // <-- Return null for invalid paths
            }
            
            // VALIDATE TEXTURE PATH FORMAT
            if (texturePath.length === 0 || texturePath.trim() === '') {
                console.warn(`Empty texture path provided`);
                return null;                                                   // <-- Return null for empty paths
            }
            
            // CREATE TEXTURE WITH ERROR HANDLING
            const texture = new BABYLON.Texture(texturePath, scene, false, false, 
                BABYLON.Texture.TRILINEAR_SAMPLINGMODE, 
                function() {
                    // SUCCESSFUL LOAD CALLBACK
                    console.log(`Successfully loaded texture: ${texturePath}`);
                }, 
                function(message) {
                    // ERROR CALLBACK
                    console.error(`Failed to load texture: ${texturePath} - ${message}`);
                }
            );
            
            return texture;                                                    // <-- Return texture object
            
        } catch (error) {
            console.error(`Exception loading texture: ${texturePath}`, error); // <-- Log exception
            return null;                                                       // <-- Return null on exception
        }
    }
    // ---------------------------------------------------------------

    // ENHANCED FUNCTION | Robust Hex Color Conversion with Validation
    // ---------------------------------------------------------------
    function hexToColor3(hex) {
        try {
            if (!hex || typeof hex !== 'string') {
                console.warn(`Invalid hex color input: ${hex}, using white`);
                return new BABYLON.Color3(1, 1, 1);                           // <-- Default white
            }
            
            // NORMALIZE HEX STRING
            const normalizedHex = hex.trim().toUpperCase();                    // <-- Normalize input
            
            // VALIDATE HEX FORMAT
            const hexPattern = /^#?([A-F\d]{2})([A-F\d]{2})([A-F\d]{2})$/;     // <-- Strict hex pattern
            const result = hexPattern.exec(normalizedHex);                     // <-- Parse hex color
            
            if (result) {
                const r = parseInt(result[1], 16) / 255;                       // <-- Red component
                const g = parseInt(result[2], 16) / 255;                       // <-- Green component
                const b = parseInt(result[3], 16) / 255;                       // <-- Blue component
                
                // VALIDATE COMPONENT RANGES
                if (isNaN(r) || isNaN(g) || isNaN(b)) {
                    console.warn(`Invalid color components for: ${hex}, using white`);
                    return new BABYLON.Color3(1, 1, 1);                       // <-- Default white on NaN
                }
                
                return new BABYLON.Color3(r, g, b);                           // <-- Return valid Color3
                
            } else {
                console.warn(`Invalid hex color format: ${hex}, using white`);
                return new BABYLON.Color3(1, 1, 1);                           // <-- Default white for invalid format
            }
            
        } catch (error) {
            console.error(`Error converting hex color ${hex}:`, error);
            return new BABYLON.Color3(1, 1, 1);                               // <-- Default white on error
        }
    }
    // ---------------------------------------------------------------

    // endregion -------------------------------------------------------------------

    // -----------------------------------------------------------------------------
    // REGION | Material Processing and Enhancement System
    // -----------------------------------------------------------------------------

    // FUNCTION | Apply Automatic Material Substitutions with Comprehensive Logging
    // ------------------------------------------------------------
    function applyAutoMaterials() {
        if (!scene || !isInitialized) {
            console.error("Cannot apply materials: scene not available or module not initialized");
            return false;
        }
        
        // RESET PROCESSING STATISTICS
        resetProcessingStats();                                                // Clear previous stats
        
        console.log("=== Starting Automatic Material Substitution ===");
        const startTime = performance.now();                                  // Track processing time
        
        // PROCESS ALL SCENE MATERIALS
        scene.materials.forEach((material, index) => {
            processingStats.totalMaterialsFound++;                            // Increment total count
            
            // ONLY PROCESS PBR MATERIALS
            if (material instanceof BABYLON.PBRMaterial) {
                processMaterial(material, index);                             // Process individual material
            } else {
                console.log(`Skipping non-PBR material: ${material.name} (${material.constructor.name})`);
            }
        });
        
        // LOG PROCESSING SUMMARY
        const endTime = performance.now();                                    // Calculate processing time
        logProcessingSummary(endTime - startTime);                            // Log comprehensive summary
        
        console.log("=== Material Substitution Complete ===");
        return processingStats.substitutionsApplied > 0;                      // Return success indicator
    }
    // ---------------------------------------------------------------

    // SUB FUNCTION | Process Individual Material for Substitution
    // ---------------------------------------------------------------
    function processMaterial(material, index) {
        try {
            // APPLY UNIVERSAL PBR ENHANCEMENTS
            material.backFaceCulling = false;                                  // Disable backface culling
            
            // EXTRACT MATERIAL CODE
            const materialCode = extractMaterialCode(material.name);           // Extract code from name
            
            if (materialCode) {
                processingStats.materialsWithCodes++;                         // Increment code count
                
                // FIND CONFIGURATION FOR CODE
                const config = findMaterialConfiguration(materialCode);       // Find matching configuration
                
                if (config) {
                    // APPLY CONFIGURATION
                    const success = applyMaterialConfiguration(material, config, material.name);
                    
                    if (success) {
                        processingStats.substitutionsApplied++;               // Increment success count
                        
                        // TRACK CATEGORY STATISTICS
                        const category = config.sourceCategory || 'specific';  // Get category or mark as specific
                        processingStats.categoriesMatched[category] = (processingStats.categoriesMatched[category] || 0) + 1;
                        
                        if (config.isRangeGenerated) {
                            processingStats.rangeMatches++;                   // Increment range matches
                        } else {
                            processingStats.specificMatches++;                // Increment specific matches
                        }
                        
                        console.log(`✅ Material ${index}: ${material.name} → Applied ${materialCode} (${category})`);
                    } else {
                        processingStats.substitutionsFailed++;                // Increment failure count
                        processingStats.failureReasons.push(`Configuration application failed for ${material.name}`);
                        console.error(`❌ Material ${index}: Failed to apply configuration for ${material.name}`);
                    }
                } else {
                    processingStats.substitutionsFailed++;                    // Increment failure count
                    processingStats.failureReasons.push(`No configuration found for code ${materialCode}`);
                    console.warn(`⚠️ Material ${index}: No configuration found for ${material.name} (${materialCode})`);
                }
            } else {
                console.log(`➡️ Material ${index}: No material code found in ${material.name}`);
            }
            
        } catch (error) {
            processingStats.substitutionsFailed++;                            // Increment failure count
            processingStats.failureReasons.push(`Processing error for ${material.name}: ${error.message}`);
            console.error(`💥 Material ${index}: Processing error for ${material.name}:`, error);
        }
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Reset Processing Statistics
    // ---------------------------------------------------------------
    function resetProcessingStats() {
        processingStats = {
            totalMaterialsFound: 0,
            materialsWithCodes: 0,
            specificMatches: 0,
            rangeMatches: 0,
            substitutionsApplied: 0,
            substitutionsFailed: 0,
            categoriesMatched: {},
            failureReasons: []
        };
    }
    // ---------------------------------------------------------------

    // HELPER FUNCTION | Log Comprehensive Processing Summary
    // ---------------------------------------------------------------
    function logProcessingSummary(processingTimeMs) {
        console.log("=== Material Processing Summary ===");
        console.log(`Processing time: ${processingTimeMs.toFixed(2)}ms`);
        console.log(`Total materials found: ${processingStats.totalMaterialsFound}`);
        console.log(`Materials with codes: ${processingStats.materialsWithCodes}`);
        console.log(`Specific matches: ${processingStats.specificMatches}`);
        console.log(`Range matches: ${processingStats.rangeMatches}`);
        console.log(`Substitutions applied: ${processingStats.substitutionsApplied}`);
        console.log(`Substitutions failed: ${processingStats.substitutionsFailed}`);
        
        // LOG CATEGORY BREAKDOWN
        if (Object.keys(processingStats.categoriesMatched).length > 0) {
            console.log("Categories matched:", processingStats.categoriesMatched);
        }
        
        // LOG FAILURE REASONS
        if (processingStats.failureReasons.length > 0) {
            console.log("Failure reasons:", processingStats.failureReasons);
        }
        
        console.log("===================================");
    }
    // ---------------------------------------------------------------

    // endregion -------------------------------------------------------------------

    // -----------------------------------------------------------------------------
    // REGION | HDRI Integration and Material Adaptation System
    // -----------------------------------------------------------------------------

    // CRITICAL FUNCTION | Update Materials for HDRI Lighting Environment
    // ---------------------------------------------------------------
    function updateMaterialsForHdri() {
        if (!scene || !scene.environmentTexture) {
            console.warn("Cannot update materials for HDRI: no scene or environment texture");
            return false;
        }

        let materialsUpdated = 0;                                              // Counter for updated materials
        console.log("Updating materials for HDRI environment...");

        scene.materials.forEach(function(material) {
            if (material instanceof BABYLON.PBRMaterial) {
                // ENHANCE ENVIRONMENT REFLECTIONS FOR HDRI
                material.environmentIntensity = 1.0;                           // Ensure full environment contribution
                material.disableLighting = false;                              // Ensure lighting is enabled

                // ADJUST METALLIC MATERIALS FOR HDRI ENVIRONMENT
                if (material.metallic > 0.5) {
                    material.reflectivityColor = new BABYLON.Color3(1.0, 1.0, 1.0); // Maximize reflectivity for metals
                    material.roughness = Math.max(0.1, material.roughness);    // Prevent over-glossiness
                }

                // ENSURE PROPER ENVIRONMENT TEXTURE USAGE FOR REFLECTIONS
                if (!material.reflectionTexture) {
                    material.reflectionTexture = scene.environmentTexture;     // Use HDRI for material reflections
                }

                // ADJUST MATERIAL BRIGHTNESS FOR HDRI LIGHTING
                if (material.albedoColor) {
                    const brightnessFactor = 1.1;                              // 10% brightness boost
                    material.albedoColor.r = Math.min(1.0, material.albedoColor.r * brightnessFactor);
                    material.albedoColor.g = Math.min(1.0, material.albedoColor.g * brightnessFactor);
                    material.albedoColor.b = Math.min(1.0, material.albedoColor.b * brightnessFactor);
                }

                materialsUpdated++;                                            // Increment counter
            }
        });

        console.log(`HDRI material adaptation complete: ${materialsUpdated} materials updated`);
        return materialsUpdated > 0;                                          // Return success indicator
    }
    // ---------------------------------------------------------------

    // CRITICAL FUNCTION | Restore Materials from HDRI to Standard Lighting
    // ---------------------------------------------------------------
    function restoreMaterialsFromHdri() {
        if (!scene) {
            console.warn("Cannot restore materials from HDRI: no scene available");
            return false;
        }

        let materialsRestored = 0;                                             // Counter for restored materials
        console.log("Restoring materials from HDRI environment...");

        scene.materials.forEach(function(material) {
            if (material instanceof BABYLON.PBRMaterial) {
                // RESTORE STANDARD ENVIRONMENT SETTINGS
                material.environmentIntensity = 1.0;                           // Reset environment intensity

                // CLEAR HDRI-SPECIFIC REFLECTION TEXTURE
                if (material.reflectionTexture === scene.environmentTexture) {
                    material.reflectionTexture = null;                         // Remove HDRI reflection reference
                }

                // RESTORE ORIGINAL MATERIAL BRIGHTNESS
                if (material.albedoColor) {
                    const brightnessFactor = 1.0 / 1.1;                        // Reverse 10% brightness boost
                    material.albedoColor.r = Math.max(0.0, material.albedoColor.r * brightnessFactor);
                    material.albedoColor.g = Math.max(0.0, material.albedoColor.g * brightnessFactor);
                    material.albedoColor.b = Math.max(0.0, material.albedoColor.b * brightnessFactor);
                }

                materialsRestored++;                                           // Increment counter
            }
        });

        console.log(`Material restoration complete: ${materialsRestored} materials restored`);
        return materialsRestored > 0;                                         // Return success indicator
    }
    // ---------------------------------------------------------------

    // endregion -------------------------------------------------------------------

    // -----------------------------------------------------------------------------
    // REGION | SSAO Integration and Transparent Material Configuration
    // -----------------------------------------------------------------------------

    // FUNCTION | Configure Transparent Materials for SSAO Compatibility
    // ---------------------------------------------------------------
    function configureTransparentMaterials() {
        if (!scene || !isInitialized) {
            console.warn("Cannot configure transparent materials: scene not available or module not initialized");
            return false;
        }

        let materialsConfigured = 0;                                       // <-- Counter for configured materials
        console.log("Configuring transparent materials for SSAO compatibility...");

        scene.materials.forEach((material, index) => {
            if (material instanceof BABYLON.PBRMaterial) {
                // IDENTIFY TRANSPARENT OR GLASS MATERIALS
                const isTransparent = material.alpha < 1.0 || 
                                     (material.name && (
                                         material.name.toLowerCase().includes('glass') ||
                                         material.name.toLowerCase().includes('window') ||
                                         material.name.toLowerCase().includes('mirror')
                                     ));

                if (isTransparent) {
                    // EXCLUDE FROM SSAO RENDERING TO PREVENT ARTIFACTS
                    material.excludeFromDepthPrePass = true;                // <-- Exclude from depth pre-pass
                    material.doNotSerialize = false;                       // <-- Allow serialization
                    
                    // CONFIGURE ALPHA BLENDING FOR PROPER TRANSPARENCY
                    if (material.alpha < 1.0) {
                        material.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHABLEND;
                        material.separateCullingPass = true;               // <-- Separate culling for transparency
                    }
                    
                    // PREVENT SSAO ARTIFACTS ON GLASS SURFACES
                    material.disableDepthWrite = material.alpha < 0.9;     // <-- Disable depth write for very transparent materials
                    
                    materialsConfigured++;                                 // <-- Increment counter
                    console.log(`Configured transparent material: ${material.name} (alpha: ${material.alpha})`);
                }
            }
        });

        console.log(`Transparent materials configured for SSAO: ${materialsConfigured} materials`);
        return materialsConfigured > 0;                                    // <-- Return success indicator
    }
    // ---------------------------------------------------------------

    // endregion -------------------------------------------------------------------

    // -----------------------------------------------------------------------------
    // REGION | Public API
    // -----------------------------------------------------------------------------
    return {
        initialize: initialize,
        applyAutoMaterials: applyAutoMaterials,
        updateMaterialsForHdri: updateMaterialsForHdri,
        restoreMaterialsFromHdri: restoreMaterialsFromHdri,
        configureTransparentMaterials: configureTransparentMaterials
    };
    // ---------------------------------------------------------------

})();
