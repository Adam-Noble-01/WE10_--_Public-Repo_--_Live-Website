// =========================================================
// THERMAL CALC TOOL - DATA LOADER
// =========================================================
//
// FILENAME  |  NA23_01_04-WebApp_-_ThermalCalcTool_-_DataLoader.js
// DIRECTORY |  na-apps/NA23_01_WebApp_-_ThermalCalcTool/
//
// AUTHOR    |  Noble Architecture
// DATE      |  2025-04-12
//
// DESCRIPTION
// - Loads and processes thermal data from JSON file
// - Makes data available to other scripts
// - Handles data validation and preprocessing
//
// DEVELOPMENT LOG
// 1.0.0 - 2025-04-12 |  Initial Development
// - Basic data loader structure created
//
// =========================================================

// LOADER | ThermalData global object
// ------------------------------------------------------------
let ThermalData = {};

// FUNCTION | Initialize the data loader
// ------------------------------------------------------------
function initDataLoader() {
    console.log("ThermalCalcTool DataLoader initialized");
    // Data will be loaded from the JSON file
}

// FUNCTION | Get material categories
// ------------------------------------------------------------
function getMaterialCategories() {
    // Return material categories from loaded data
    return ThermalData.material_categories || {};
}

// FUNCTION | Get material by ID
// ------------------------------------------------------------
function getMaterialById(categoryId, materialId, productId, variantId = null) {
    // Return specific material data based on IDs
    try {
        const category = ThermalData.material_categories[categoryId];
        const material = category.materials[materialId];
        const product = material.products[productId];
        
        if (product.is_product && variantId) {
            return product.variants[variantId];
        } else {
            return product;
        }
    } catch (error) {
        console.error("Error retrieving material:", error);
        return null;
    }
}

// FUNCTION | Check if material is a product with fixed thickness
// ------------------------------------------------------------
function isFixedThicknessProduct(categoryId, materialId, productId) {
    try {
        const category = ThermalData.material_categories[categoryId];
        const material = category.materials[materialId];
        const product = material.products[productId];
        
        return product.is_product === true;
    } catch (error) {
        console.error("Error checking product type:", error);
        return false;
    }
}

// Initialize data loader when script loads
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', initDataLoader); 