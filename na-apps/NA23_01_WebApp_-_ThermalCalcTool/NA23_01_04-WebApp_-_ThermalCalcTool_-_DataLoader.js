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
// FILE REFERENCED AND PROCESSED
// - This script is designed to load
//   `NA23_01_03-WebApp_-_ThermalCalcTool_-_ThermalData.json`
//   and process it into a format that can be used by other scripts.
//
// DEVELOPMENT LOG
// 1.0.0 - 2025-04-12 |  Initial Development
// - Basic data loader structure created
//
// 1.1.0 - 2025-04-18 |  JSON Loading Implementation
// - Added fetch functionality for JSON data
// - Implemented data processing and validation
// - Added comprehensive helper methods for accessing data
//
// 1.2.0 - 2025-04-20 |  Structure Adaptation
// - Modified to work with existing JSON structure
// - Added transformation logic to adapt to different data hierarchy
// - Updated validation checks to match actual JSON format
//
// =========================================================

// CONFIG | Constants for data loading
// ------------------------------------------------------------
const DATA_CONFIG = {
    DATA_PATH: './NA23_01_03-WebApp_-_ThermalCalcTool_-_ThermalData.json',
    VALIDATION: {
        REQUIRED_ROOT_KEYS: ['File_Metadata', 'file-version-history-log'],
        SKIP_KEYS: ['File_Metadata', 'file-version-history-log'],
        MIN_CATEGORIES: 1
    }
};

// LOADER | ThermalData global object
// ------------------------------------------------------------
let ThermalData = {};
let RawData = {};
let isDataLoaded = false;
let loadingPromise = null;

// FUNCTION | Load thermal data from JSON file
// ------------------------------------------------------------
async function loadThermalData() {
    if (loadingPromise) {
        return loadingPromise;
    }
    
    loadingPromise = new Promise((resolve, reject) => {
        console.log(`Loading thermal data from ${DATA_CONFIG.DATA_PATH}`);
        
        fetch(DATA_CONFIG.DATA_PATH)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load thermal data. Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log("Thermal data loaded successfully");
                
                // Store raw data
                RawData = data;
                
                // Validate data structure
                if (!validateDataStructure(data)) {
                    throw new Error("Thermal data validation failed");
                }
                
                // Process and store data
                ThermalData = processData(data);
                isDataLoaded = true;
                
                resolve(ThermalData);
            })
            .catch(error => {
                console.error("Error loading thermal data:", error);
                reject(error);
            });
    });
    
    return loadingPromise;
}

// FUNCTION | Validate data structure
// ------------------------------------------------------------
function validateDataStructure(data) {
    // Check required root keys
    for (const key of DATA_CONFIG.VALIDATION.REQUIRED_ROOT_KEYS) {
        if (!data.hasOwnProperty(key)) {
            console.error(`Thermal data missing required key: ${key}`);
            return false;
        }
    }
    
    // Count material categories (all root keys except metadata-related ones)
    const categoryKeys = Object.keys(data).filter(key => !DATA_CONFIG.VALIDATION.SKIP_KEYS.includes(key));
    if (categoryKeys.length < DATA_CONFIG.VALIDATION.MIN_CATEGORIES) {
        console.error("Thermal data has no material categories");
        return false;
    }
    
    // Basic validation passed
    return true;
}

// FUNCTION | Process and prepare data
// ------------------------------------------------------------
function processData(data) {
    // Create a transformed structure that matches our expected format
    const transformedData = {
        material_categories: {},
        version: getVersionFromRaw(data),
        last_updated: getLastUpdatedFromRaw(data)
    };
    
    // Process all material categories (all root keys except metadata-related ones)
    Object.keys(data).forEach(key => {
        if (!DATA_CONFIG.VALIDATION.SKIP_KEYS.includes(key)) {
            const category = data[key];
            
            // Create a category in the transformed data
            transformedData.material_categories[key] = {
                name: formatCategoryName(key),
                materials: {}
            };
            
            // Process each material in this category
            Object.keys(category).forEach(materialId => {
                const material = category[materialId];
                
                // Create a material entry
                transformedData.material_categories[key].materials[materialId] = {
                    name: formatMaterialName(materialId),
                    products: {}
                };
                
                // Handle "is_product" flag to determine if this is a simple product or a container of variants
                if (material.is_product === true) {
                    // This is a product with variants
                    transformedData.material_categories[key].materials[materialId].products[materialId] = {
                        name: formatMaterialName(materialId),
                        is_product: true,
                        variants: {}
                    };
                    
                    // Process each variant
                    Object.keys(material).forEach(variantId => {
                        if (variantId !== 'is_product') {
                            const variant = material[variantId];
                            
                            // Pre-calculate R-value if needed
                            if (variant.thickness && variant.lambda && !variant.r_value) {
                                // Convert thickness from mm to m
                                const thicknessInMeters = variant.thickness / 1000;
                                variant.r_value = thicknessInMeters / variant.lambda;
                            }
                            
                            transformedData.material_categories[key].materials[materialId].products[materialId].variants[variantId] = {
                                name: formatVariantName(variantId),
                                ...variant
                            };
                        }
                    });
                } else {
                    // This is a material with multiple products (no is_product flag or false)
                    Object.keys(material).forEach(productId => {
                        const product = material[productId];
                        
                        // Check if this product has sub-products (variants)
                        if (product.is_product === true) {
                            // This product has variants
                            transformedData.material_categories[key].materials[materialId].products[productId] = {
                                name: formatProductName(productId),
                                is_product: true,
                                variants: {}
                            };
                            
                            // Process each variant
                            Object.keys(product).forEach(variantId => {
                                if (variantId !== 'is_product') {
                                    const variant = product[variantId];
                                    
                                    // Pre-calculate R-value if needed
                                    if (variant.thickness && variant.lambda && !variant.r_value) {
                                        // Convert thickness from mm to m
                                        const thicknessInMeters = variant.thickness / 1000;
                                        variant.r_value = thicknessInMeters / variant.lambda;
                                    }
                                    
                                    transformedData.material_categories[key].materials[materialId].products[productId].variants[variantId] = {
                                        name: formatVariantName(variantId),
                                        ...variant
                                    };
                                }
                            });
                        } else {
                            // This is a simple product
                            // Pre-calculate R-value if needed
                            if (product.thickness && product.lambda && !product.r_value) {
                                // Convert thickness from mm to m
                                const thicknessInMeters = product.thickness / 1000;
                                product.r_value = thicknessInMeters / product.lambda;
                            }
                            
                            transformedData.material_categories[key].materials[materialId].products[productId] = {
                                name: formatProductName(productId),
                                is_product: false,
                                ...product
                            };
                        }
                    });
                }
            });
        }
    });
    
    return transformedData;
}

// FUNCTION | Format names from IDs
// ------------------------------------------------------------
function formatCategoryName(categoryId) {
    return categoryId.replace(/-/g, ' ');
}

function formatMaterialName(materialId) {
    return materialId.replace(/-/g, ' ');
}

function formatProductName(productId) {
    return productId.replace(/-/g, ' ');
}

function formatVariantName(variantId) {
    return variantId.replace(/-/g, ' ');
}

// FUNCTION | Extract version from raw data
// ------------------------------------------------------------
function getVersionFromRaw(data) {
    if (data['file-version-history-log'] && data['file-version-history-log'].length > 0) {
        return data['file-version-history-log'][0].version || 'unknown';
    }
    return 'unknown';
}

// FUNCTION | Extract last updated date from raw data
// ------------------------------------------------------------
function getLastUpdatedFromRaw(data) {
    if (data['file-version-history-log'] && data['file-version-history-log'].length > 0) {
        return data['file-version-history-log'][0]['log-date'] || 'unknown';
    }
    return 'unknown';
}

// FUNCTION | Initialize the data loader
// ------------------------------------------------------------
async function initDataLoader() {
    try {
        console.log("ThermalCalcTool DataLoader initializing");
        await loadThermalData();
        console.log("ThermalCalcTool DataLoader initialized");
        return true;
    } catch (error) {
        console.error("ThermalCalcTool DataLoader initialization failed:", error);
        return false;
    }
}

// FUNCTION | Check if data is loaded
// ------------------------------------------------------------
function isDataReady() {
    return isDataLoaded;
}

// FUNCTION | Get data version info
// ------------------------------------------------------------
function getDataVersion() {
    return {
        version: ThermalData.version || "unknown",
        lastUpdated: ThermalData.last_updated || "unknown"
    };
}

// FUNCTION | Access raw untransformed data (for debugging)
// ------------------------------------------------------------
function getRawData() {
    return RawData;
}

// FUNCTION | Get material categories
// ------------------------------------------------------------
function getMaterialCategories() {
    // Return material categories from loaded data
    return ThermalData.material_categories || {};
}

// FUNCTION | Get category by ID
// ------------------------------------------------------------
function getCategoryById(categoryId) {
    if (!ThermalData.material_categories) {
        console.error("Material categories not loaded");
        return null;
    }
    
    return ThermalData.material_categories[categoryId] || null;
}

// FUNCTION | Get all materials in a category
// ------------------------------------------------------------
function getMaterialsInCategory(categoryId) {
    const category = getCategoryById(categoryId);
    
    if (!category || !category.materials) {
        return {};
    }
    
    return category.materials;
}

// FUNCTION | Get material by ID
// ------------------------------------------------------------
function getMaterialById(categoryId, materialId) {
    try {
        if (!categoryId || !materialId) {
            console.warn("Missing parameters in getMaterialById", { categoryId, materialId });
            return null;
        }
        
        const categories = getMaterialCategories();
        
        if (!categories || !categories[categoryId]) {
            console.warn(`Category not found: ${categoryId}`);
            return null;
        }
        
        const category = categories[categoryId];
        
        if (!category.materials || !category.materials[materialId]) {
            console.warn(`Material not found: ${materialId} in category ${categoryId}`);
            return null;
        }
        
        return category.materials[materialId];
    } catch (error) {
        console.error("Error in getMaterialById:", error);
        return null;
    }
}

// FUNCTION | Get product by ID with detailed error handling
// ------------------------------------------------------------
function getProductById(categoryId, materialId, productId) {
    try {
        if (!categoryId || !materialId) {
            console.warn("Missing category or material ID in getProductById", { categoryId, materialId });
            return null;
        }
        
        // For non-product queries, gracefully handle missing productId
        if (!productId) {
            console.warn("No product ID provided to getProductById");
            return null;
        }
        
        const material = getMaterialById(categoryId, materialId);
        
        if (!material) {
            console.warn(`Material not found: ${materialId} in category ${categoryId}`);
            return null;
        }
        
        if (!material.products) {
            console.warn(`No products found in material: ${materialId}`);
            return null;
        }
        
        const product = material.products[productId];
        
        if (!product) {
            console.warn(`Product not found: ${productId} in material ${materialId}`);
            return null;
        }
        
        return product;
    } catch (error) {
        console.error("Error in getProductById:", error);
        return null;
    }
}

// FUNCTION | Get variant by ID
// ------------------------------------------------------------
function getVariantById(categoryId, materialId, productId, variantId) {
    try {
        const product = getProductById(categoryId, materialId, productId);
        
        if (!product || !product.is_product || !product.variants) {
            return null;
        }
        
        return product.variants[variantId] || null;
    } catch (error) {
        console.error("Error retrieving variant:", error);
        return null;
    }
}

// FUNCTION | Get specific material data based on all IDs
// ------------------------------------------------------------
function getMaterialData(categoryId, materialId, productId, variantId = null) {
    try {
        const product = getProductById(categoryId, materialId, productId);
        
        if (!product) {
            return null;
        }
        
        if (product.is_product && variantId) {
            return product.variants[variantId];
        } else {
            return product;
        }
    } catch (error) {
        console.error("Error retrieving material data:", error);
        return null;
    }
}

// FUNCTION | Check if material is a fixed thickness product
// ------------------------------------------------------------
function isFixedThicknessProduct(categoryId, materialId) {
    try {
        if (!categoryId || !materialId) {
            console.warn("Missing parameters in isFixedThicknessProduct", { categoryId, materialId });
            return false;
        }
        
        const material = getMaterialById(categoryId, materialId);
        
        if (!material) {
            console.warn(`Material not found: ${materialId} in category ${categoryId}`);
            return false;
        }
        
        // Check if this is a product with fixed thickness options
        return material.is_product === true;
    } catch (error) {
        console.error("Error in isFixedThicknessProduct:", error);
        return false;
    }
}

// FUNCTION | Get all available material options for dropdown lists
// ------------------------------------------------------------
function getAllMaterialOptions() {
    const options = [];
    
    if (!ThermalData.material_categories) {
        return options;
    }
    
    // Process each category
    Object.entries(ThermalData.material_categories).forEach(([categoryId, category]) => {
        // Process each material in the category
        Object.entries(category.materials || {}).forEach(([materialId, material]) => {
            // Process each product in the material
            Object.entries(material.products || {}).forEach(([productId, product]) => {
                // If it's a product with variants
                if (product.is_product && product.variants) {
                    // Process each variant
                    Object.entries(product.variants).forEach(([variantId, variant]) => {
                        options.push({
                            categoryId,
                            categoryName: category.name,
                            materialId,
                            materialName: material.name,
                            productId,
                            productName: product.name,
                            variantId,
                            variantName: variant.name,
                            lambda: variant.lambda,
                            thickness: variant.thickness,
                            r_value: variant.r_value
                        });
                    });
                } 
                // If it's a regular material/product
                else {
                    options.push({
                        categoryId,
                        categoryName: category.name,
                        materialId,
                        materialName: material.name,
                        productId,
                        productName: product.name,
                        lambda: product.lambda,
                        thickness: product.thickness,
                        r_value: product.r_value
                    });
                }
            });
        });
    });
    
    return options;
}

// FUNCTION | Calculate R-value for a material
// ------------------------------------------------------------
function calculateMaterialRValue(categoryId, materialId, productId, variantId = null, thickness = null) {
    const materialData = getMaterialData(categoryId, materialId, productId, variantId);
    
    if (!materialData) {
        return 0;
    }
    
    // If the material has a pre-calculated r_value
    if (materialData.r_value) {
        return materialData.r_value;
    }
    
    // If we need to calculate based on a custom thickness
    if (materialData.lambda && thickness) {
        // Convert thickness from mm to m
        const thicknessInMeters = thickness / 1000;
        // Calculate R-value: R = d/λ
        return thicknessInMeters / materialData.lambda;
    }
    
    return 0;
}

// FUNCTION | Debug data structure (for development)
// ------------------------------------------------------------
function debugDataStructure() {
    console.log("Full Thermal Data:", ThermalData);
    console.log("Material Categories:", getMaterialCategories());
    
    const categories = getMaterialCategories();
    for (const categoryId in categories) {
        console.log(`Category: ${categoryId}`);
        const materials = getMaterialsInCategory(categoryId);
        console.log(`Materials in ${categoryId}:`, materials);
        
        for (const materialId in materials) {
            console.log(`Material: ${materialId}`);
            const material = getMaterialById(categoryId, materialId);
            console.log(`Material details:`, material);
            
            if (material.products) {
                console.log(`Products in ${materialId}:`, material.products);
            }
        }
    }
}

// Call this function after data is loaded to verify structure
function verifyDataLoaded() {
    if (!isDataLoaded) {
        console.error("Thermal data not loaded yet");
        return false;
    }
    
    console.log("Thermal data loaded successfully");
    debugDataStructure();
    return true;
}

// FUNCTION | Log detailed JSON structure for debugging
// ------------------------------------------------------------
function logJsonStructure() {
    console.log("=== THERMAL DATA STRUCTURE ===");
    console.log("Categories:");
    
    const categories = ThermalData.material_categories || {};
    for (const categoryId in categories) {
        console.log(`- Category: ${categoryId}`);
        const category = categories[categoryId];
        const materials = category.materials || {};
        
        console.log(`  Materials (${Object.keys(materials).length}):`);
        for (const materialId in materials) {
            console.log(`  - Material: ${materialId}`);
            const material = materials[materialId];
            
            if (material.is_product) {
                console.log(`    [PRODUCT] Lambda: ${material.lambda}`);
                
                if (material.products) {
                    console.log(`    Products (${Object.keys(material.products).length}):`);
                    for (const productId in material.products) {
                        const product = material.products[productId];
                        console.log(`    - Product: ${productId}`);
                        
                        if (product.variants) {
                            console.log(`      Variants (${Object.keys(product.variants).length}):`);
                            for (const variantId in product.variants) {
                                const variant = product.variants[variantId];
                                console.log(`      - ${variantId}: lambda=${variant.lambda}, thickness=${variant.thickness || "N/A"}`);
                            }
                        } else {
                            console.log(`      No variants found. Direct properties: lambda=${product.lambda}, thickness=${product.thickness || "N/A"}`);
                        }
                    }
                } else {
                    console.log(`    No products found.`);
                }
            } else {
                console.log(`    [VARIABLE] Lambda: ${material.lambda}`);
            }
        }
    }
    
    console.log("=== END STRUCTURE LOG ===");
}

// FUNCTION | Print sample material structure to console
// ------------------------------------------------------------
function printSampleMaterial() {
    try {
        const categories = getMaterialCategories();
        if (!categories || Object.keys(categories).length === 0) {
            console.error("No categories found in thermal data");
            return;
        }
        
        // Get first category
        const firstCategoryId = Object.keys(categories)[0];
        const firstCategory = categories[firstCategoryId];
        console.log("Sample category:", firstCategoryId, firstCategory);
        
        // Get first material
        if (!firstCategory.materials || Object.keys(firstCategory.materials).length === 0) {
            console.error("No materials found in first category");
            return;
        }
        
        const firstMaterialId = Object.keys(firstCategory.materials)[0];
        const firstMaterial = firstCategory.materials[firstMaterialId];
        console.log("Sample material:", firstMaterialId, firstMaterial);
        
        // Check if it's a product
        console.log("Is product:", firstMaterial.is_product);
        
        // Check for products if it's a product type
        if (firstMaterial.is_product && firstMaterial.products) {
            const firstProductId = Object.keys(firstMaterial.products)[0];
            const firstProduct = firstMaterial.products[firstProductId];
            console.log("Sample product:", firstProductId, firstProduct);
        }
    } catch (error) {
        console.error("Error printing sample material:", error);
    }
}

// Initialize data loader when script loads
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', initDataLoader);

// Export functions for use in other modules
// ------------------------------------------------------------
export {
    initDataLoader,
    loadThermalData,
    isDataReady,
    getDataVersion,
    getRawData,
    getMaterialCategories,
    getCategoryById,
    getMaterialsInCategory,
    getMaterialById,
    getProductById,
    getVariantById,
    getMaterialData,
    isFixedThicknessProduct,
    getAllMaterialOptions,
    calculateMaterialRValue,
    debugDataStructure,
    verifyDataLoaded,
    logJsonStructure,
    printSampleMaterial
};