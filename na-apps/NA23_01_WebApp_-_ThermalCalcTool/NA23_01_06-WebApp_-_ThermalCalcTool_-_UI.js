// =========================================================
// THERMAL CALC TOOL - USER INTERFACE
// =========================================================
//
// FILENAME  |  NA23_01_06-WebApp_-_ThermalCalcTool_-_UI.js
// DIRECTORY |  na-apps/NA23_01_WebApp_-_ThermalCalcTool/
//
// AUTHOR    |  Noble Architecture
// DATE      |  2025-04-12
//
// DESCRIPTION
// - Handles all user interface interactions
// - Manages form elements and user input
// - Updates UI based on calculation results
// - Manages material selection and thickness inputs
//
// DEVELOPMENT LOG
// 1.0.0 - 2025-04-12 |  Initial Development
// - Basic UI structure created
// 1.1.0 - 2025-05-11 |  Full UI Implementation
// - Added material layer management
// - Implemented calculation flow and display
// - Added event handlers for all UI elements
//
// =========================================================

// Import required modules
// ------------------------------------------------------------
import {
    isDataReady,
    getMaterialCategories,
    getMaterialsInCategory,
    getProductById,
    isFixedThicknessProduct,
    calculateMaterialRValue,
    getMaterialById,
    printSampleMaterial
  } from './NA23_01_04-WebApp_-_ThermalCalcTool_-_DataLoader.js';
  
  import {
    calculateRValue,
    calculateTotalRValue,
    calculateUValue,
    calculateConstructionUValue,
    SURFACE_RESISTANCE
  } from './NA23_01_05-WebApp_-_ThermalCalcTool_-_MathUtils.js';
  
  // CONFIG | Constants for UI
  // ------------------------------------------------------------
  const UI_CONFIG = {
    ICON_URLS: {
      DELETE: 'https://www.noble-architecture.com/assets/AD05_-_LIBR_-_Common_-_Icons-and-favicons/AD05_14_-_Icon_-_Delete-Bin.svg',
      ADD: 'https://www.noble-architecture.com/assets/AD05_-_LIBR_-_Common_-_Icons-and-favicons/AD05_15_-_Icon_-_Plus-Symbol.svg'
    },
    ELEMENT_IDS: {
      CONTROL_PANEL: 'control-panel',
      MATERIAL_LAYERS: 'material-layers',
      CALCULATION_DISPLAY: 'calculation-display',
      RESULTS_DISPLAY: 'results-display',
      CAVEATS_SECTION: 'caveats-section'
    }
  };
  
  // LOADER | UI initialization
  // ------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', initUI);
  
  // FUNCTION | Initialize the UI
  // ------------------------------------------------------------
  function initUI() {
    console.log("ThermalCalcTool UI initializing");
    
    // Wait for data to be loaded before setting up UI
    const checkDataInterval = setInterval(() => {
      if (isDataReady()) {
        clearInterval(checkDataInterval);
        console.log("Data is ready, setting up UI");
        
        // Debug data structure
        if (typeof printSampleMaterial === 'function') {
          printSampleMaterial();
        }
        
        setupControlPanel();
        setupEventListeners();
        console.log("ThermalCalcTool UI initialized");
      } else {
        console.log("Waiting for data to load...");
      }
    }, 500);
  }
  
  // FUNCTION | Set up the control panel
  // ------------------------------------------------------------
  function setupControlPanel() {
    // Set up the control panel with form elements
    const controlBlock = document.querySelector('.CTRL__block');
    
    // Clear any existing content
    controlBlock.innerHTML = '';
    
    // Create form container
    const formContainer = document.createElement('form');
    formContainer.id = UI_CONFIG.ELEMENT_IDS.CONTROL_PANEL;
    formContainer.classList.add('UCALC__form');
    formContainer.addEventListener('submit', handleFormSubmit);
    
    // Create materials section
    const materialsSection = document.createElement('div');
    materialsSection.classList.add('UCALC__materials-section');
    
    // Create heading for materials section
    const sectionHeading = document.createElement('h3');
    sectionHeading.classList.add('UCALC__section-heading');
    sectionHeading.textContent = 'Construction Layers';
    materialsSection.appendChild(sectionHeading);
    
    // Create layers container
    const layersContainer = document.createElement('div');
    layersContainer.id = UI_CONFIG.ELEMENT_IDS.MATERIAL_LAYERS;
    layersContainer.classList.add('UCALC__layers-container');
    
    // Add internal surface resistance (Rsi) - always first
    const internalResistanceLayer = createFixedResistanceLayer(
      'Internal Surface Resistance (Rsi)', 
      0.13, // Hard-coded value to avoid import issues
      true
    );
    layersContainer.appendChild(internalResistanceLayer);
    
    // Add initial material layer
    const initialLayer = createMaterialLayer();
    layersContainer.appendChild(initialLayer);
    
    // Add external surface resistance (Rse) - always last
    const externalResistanceLayer = createFixedResistanceLayer(
      'External Surface Resistance (Rse)', 
      0.04, // Hard-coded value to avoid import issues
      false
    );
    layersContainer.appendChild(externalResistanceLayer);
    
    // Add layers container to materials section
    materialsSection.appendChild(layersContainer);
    
    // Create add button container
    const addButtonContainer = document.createElement('div');
    addButtonContainer.classList.add('UCALC__add-button-container');
    
    // Create add button
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.classList.add('UCALC__add-button', 'BTTN__icon-button');
    addButton.innerHTML = `<img src="${UI_CONFIG.ICON_URLS.ADD}" alt="Add" class="UCALC__icon">`;
    addButton.addEventListener('click', addMaterialLayer);
    addButtonContainer.appendChild(addButton);
    
    // Add button container to materials section
    materialsSection.appendChild(addButtonContainer);
    
    // Add materials section to form
    formContainer.appendChild(materialsSection);
    
    // Create calculation display section
    const calculationDisplay = document.createElement('div');
    calculationDisplay.id = UI_CONFIG.ELEMENT_IDS.CALCULATION_DISPLAY;
    calculationDisplay.classList.add('UCALC__calculation-display');
    formContainer.appendChild(calculationDisplay);
    
    // Create results display section
    const resultsDisplay = document.createElement('div');
    resultsDisplay.id = UI_CONFIG.ELEMENT_IDS.RESULTS_DISPLAY;
    resultsDisplay.classList.add('UCALC__results-display');
    formContainer.appendChild(resultsDisplay);
    
    // Create caveats section (collapsible)
    const caveatsSection = document.createElement('details');
    caveatsSection.id = UI_CONFIG.ELEMENT_IDS.CAVEATS_SECTION;
    caveatsSection.classList.add('UCALC__caveats-section');
    
    const caveatsSummary = document.createElement('summary');
    caveatsSummary.classList.add('UCALC__caveats-summary');
    caveatsSummary.textContent = 'Caveats and Notes';
    caveatsSection.appendChild(caveatsSummary);
    
    const caveatsList = document.createElement('ul');
    caveatsList.classList.add('UCALC__caveats-list');
    
    const caveats = [
      'All calculations are based on the ISO 6946:2017(E) standards.',
      'All calculations are based on the material properties researched on 11ᵗʰ May 2025.',
      'These figures are general and are not specific to any project, building or application.',
      'The figures are intended for guidance only and are not intended to be used as a substitute for professional advice from a qualified thermal engineering professional.'
    ];
    
    caveats.forEach(caveat => {
      const caveatItem = document.createElement('li');
      caveatItem.textContent = caveat;
      caveatsList.appendChild(caveatItem);
    });
    
    caveatsSection.appendChild(caveatsList);
    formContainer.appendChild(caveatsSection);
    
    // Add form to control block
    controlBlock.appendChild(formContainer);
    
    // Initial calculation
    calculateResults();
  }
  
  // FUNCTION | Create a fixed resistance layer (internal or external surface)
  // ------------------------------------------------------------
  function createFixedResistanceLayer(name, rValue, isInternal) {
    const layerContainer = document.createElement('div');
    layerContainer.classList.add('UCALC__layer', 'UCALC__fixed-layer');
    layerContainer.dataset.rValue = rValue;
    layerContainer.dataset.type = isInternal ? 'internal' : 'external';
    
    const layerLabel = document.createElement('div');
    layerLabel.classList.add('UCALC__layer-label');
    layerLabel.textContent = name;
    layerContainer.appendChild(layerLabel);
    
    const layerValueContainer = document.createElement('div');
    layerValueContainer.classList.add('UCALC__layer-value');
    layerValueContainer.textContent = `R-value: ${rValue} m²K/W`;
    layerContainer.appendChild(layerValueContainer);
    
    return layerContainer;
  }
  
  // FUNCTION | Create a material layer with selection controls
  // ------------------------------------------------------------
  function createMaterialLayer() {
    const layerContainer = document.createElement('div');
    layerContainer.classList.add('UCALC__layer', 'UCALC__material-layer');
    
    // Get material categories
    const categories = getMaterialCategories();
    
    // Create category selection dropdown
    const categoryContainer = document.createElement('div');
    categoryContainer.classList.add('UCALC__dropdown-container');
    
    const categoryLabel = document.createElement('label');
    categoryLabel.classList.add('UCALC__input-label');
    categoryLabel.textContent = 'Material Category:';
    categoryContainer.appendChild(categoryLabel);
    
    const categorySelect = document.createElement('select');
    categorySelect.classList.add('UCALC__select');
    categorySelect.required = true;
    
    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select Category --';
    defaultOption.selected = true;
    defaultOption.disabled = true;
    categorySelect.appendChild(defaultOption);
    
    // Add category options
    for (const categoryId in categories) {
        const option = document.createElement('option');
        option.value = categoryId;
        option.textContent = categories[categoryId].name || categoryId;
        categorySelect.appendChild(option);
    }
    
    categorySelect.addEventListener('change', handleCategoryChange);
    categoryContainer.appendChild(categorySelect);
    layerContainer.appendChild(categoryContainer);
    
    // Create material selection dropdown (initially empty)
    const materialContainer = document.createElement('div');
    materialContainer.classList.add('UCALC__dropdown-container');
    
    const materialLabel = document.createElement('label');
    materialLabel.classList.add('UCALC__input-label');
    materialLabel.textContent = 'Material:';
    materialContainer.appendChild(materialLabel);
    
    const materialSelect = document.createElement('select');
    materialSelect.classList.add('UCALC__select');
    materialSelect.disabled = true;
    materialSelect.required = true;
    
    const materialDefault = document.createElement('option');
    materialDefault.value = '';
    materialDefault.textContent = '-- Select Material --';
    materialDefault.selected = true;
    materialDefault.disabled = true;
    materialSelect.appendChild(materialDefault);
    
    materialSelect.addEventListener('change', handleMaterialChange);
    materialContainer.appendChild(materialSelect);
    layerContainer.appendChild(materialContainer);
    
    // Create thickness input container
    const thicknessContainer = document.createElement('div');
    thicknessContainer.classList.add('UCALC__input-container');
    
    const thicknessLabel = document.createElement('label');
    thicknessLabel.classList.add('UCALC__input-label');
    thicknessLabel.textContent = 'Thickness (mm):';
    thicknessContainer.appendChild(thicknessLabel);
    
    const thicknessInput = document.createElement('input');
    thicknessInput.type = 'number';
    thicknessInput.classList.add('UCALC__input');
    thicknessInput.min = '0.1';
    thicknessInput.step = '0.1';
    thicknessInput.required = true;
    thicknessInput.disabled = true;
    thicknessInput.addEventListener('change', handleThicknessChange);
    thicknessContainer.appendChild(thicknessInput);
    layerContainer.appendChild(thicknessContainer);
    
    // Create r-value display (hidden until needed)
    const rValueDisplay = document.createElement('div');
    rValueDisplay.classList.add('UCALC__r-value-display');
    rValueDisplay.textContent = 'R-value: -- m²K/W';
    rValueDisplay.style.display = 'none'; // Hide initially, show when material selected
    layerContainer.appendChild(rValueDisplay);
    
    // Create delete button
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.classList.add('UCALC__delete-button', 'BTTN__icon-button');
    deleteButton.innerHTML = `<img src="${UI_CONFIG.ICON_URLS.DELETE}" alt="Delete" class="UCALC__icon">`;
    deleteButton.addEventListener('click', () => removeMaterialLayer(layerContainer));
    layerContainer.appendChild(deleteButton);
    
    return layerContainer;
  }
  
  // FUNCTION | Handle category selection change
  // ------------------------------------------------------------
  function handleCategoryChange(event) {
    const categorySelect = event.target;
    const layerContainer = categorySelect.closest('.UCALC__material-layer');
    const materialSelect = layerContainer.querySelector('.UCALC__dropdown-container:nth-of-type(2) .UCALC__select');
    const thicknessContainer = layerContainer.querySelector('.UCALC__input-container');
    const rValueDisplay = layerContainer.querySelector('.UCALC__r-value-display');
    
    // Clear and reset material selection
    materialSelect.innerHTML = '';
    materialSelect.disabled = true;
    
    const materialDefault = document.createElement('option');
    materialDefault.value = '';
    materialDefault.textContent = '-- Select Material --';
    materialDefault.selected = true;
    materialDefault.disabled = true;
    materialSelect.appendChild(materialDefault);
    
    // Reset thickness container to default input field
    thicknessContainer.innerHTML = '';
    
    const thicknessLabel = document.createElement('label');
    thicknessLabel.classList.add('UCALC__input-label');
    thicknessLabel.textContent = 'Thickness (mm):';
    thicknessContainer.appendChild(thicknessLabel);
    
    const thicknessInput = document.createElement('input');
    thicknessInput.type = 'number';
    thicknessInput.classList.add('UCALC__input');
    thicknessInput.min = '0.1';
    thicknessInput.step = '0.1';
    thicknessInput.required = true;
    thicknessInput.disabled = true;
    thicknessInput.addEventListener('change', handleThicknessChange);
    thicknessContainer.appendChild(thicknessInput);
    
    // Clear R-value display
    rValueDisplay.style.display = 'none';
    
    // Reset layer data
    delete layerContainer.dataset.lambda;
    delete layerContainer.dataset.rValue;
    delete layerContainer.dataset.thickness;
    
    // Get selected category
    const categoryId = categorySelect.value;
    if (!categoryId) {
      return;
    }
    
    // Get materials in selected category
    const materials = getMaterialsInCategory(categoryId);
    console.log("Materials in category:", materials);
    
    if (!materials || Object.keys(materials).length === 0) {
      console.error(`No materials found for category: ${categoryId}`);
      return;
    }
    
    // Populate material options
    for (const materialId in materials) {
      const option = document.createElement('option');
      option.value = materialId;
      option.textContent = materials[materialId].name || materialId;
      materialSelect.appendChild(option);
    }
    
    // Enable material selection
    materialSelect.disabled = false;
    
    // Update UI for calculation
    calculateResults();
  }
  
  // FUNCTION | Handle material selection change
  // ------------------------------------------------------------
  function handleMaterialChange(event) {
    const materialSelect = event.target;
    const layerContainer = materialSelect.closest('.UCALC__material-layer');
    const categorySelect = layerContainer.querySelector('.UCALC__dropdown-container:nth-of-type(1) .UCALC__select');
    const thicknessContainer = layerContainer.querySelector('.UCALC__input-container');
    const rValueDisplay = layerContainer.querySelector('.UCALC__r-value-display');
    
    // Get selected category and material
    const categoryId = categorySelect.value;
    const materialId = materialSelect.value;
    
    console.log(`Material changed: category=${categoryId}, material=${materialId}`);
    
    if (!categoryId || !materialId) {
      return;
    }
    
    // Get material data
    try {
      const material = getMaterialById(categoryId, materialId);
      
      if (!material) {
        console.error(`Material not found: ${materialId}`);
        return;
      }
      
      console.log("Material data:", material);
      
      // Check if material has is_product flag in the JSON data file
      const isProduct = Object.values(material.products).some(product => 
        product.is_product === true && product.variants && Object.keys(product.variants).length > 0
      );
      
      // Reset the thickness container
      thicknessContainer.innerHTML = '';
      
      // Add the label back
      const thicknessLabel = document.createElement('label');
      thicknessLabel.classList.add('UCALC__input-label');
      thicknessLabel.textContent = 'Thickness (mm):';
      thicknessContainer.appendChild(thicknessLabel);
      
      // Clear R-value display
      rValueDisplay.style.display = 'none';
      
      if (isProduct) {
        console.log(`Material ${materialId} is a product with fixed thickness variants`);
        
        // Create a thickness dropdown instead of an input
        const thicknessSelect = document.createElement('select');
        thicknessSelect.classList.add('UCALC__select');
        thicknessSelect.required = true;
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '-- Select Thickness --';
        defaultOption.selected = true;
        defaultOption.disabled = true;
        thicknessSelect.appendChild(defaultOption);
        
        // Gather thickness options from all products
        const thicknessOptions = [];
        
        for (const productId in material.products) {
          const product = material.products[productId];
          
          if (product.is_product && product.variants) {
            // Add each thickness variant as an option
            for (const variantId in product.variants) {
              const variant = product.variants[variantId];
              let thickness = 0;
              let displayName = '';
              
              // Extract thickness from the variant
              if (variant.thickness) {
                thickness = parseFloat(variant.thickness);
                displayName = `${thickness}mm`;
              } else {
                // Try to extract from the variant ID (e.g., "50mm-Thickness")
                const thicknessMatch = variantId.match(/(\d+)mm/);
                if (thicknessMatch && thicknessMatch[1]) {
                  thickness = parseFloat(thicknessMatch[1]);
                  displayName = `${thickness}mm`;
                } else {
                  displayName = variantId;
                }
              }
              
              // Store option data for sorting
              thicknessOptions.push({
                value: `${productId}:${variantId}`,
                text: displayName,
                thickness: thickness,
                lambda: variant.lambda
              });
            }
          }
        }
        
        // Sort options by thickness (numerical order)
        thicknessOptions.sort((a, b) => a.thickness - b.thickness);
        
        // Add options to select
        thicknessOptions.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.text;
          optionElement.dataset.lambda = option.lambda;
          thicknessSelect.appendChild(optionElement);
        });
        
        // Add change event listener
        thicknessSelect.addEventListener('change', handleThicknessSelection);
        
        // Add to container
        thicknessContainer.appendChild(thicknessSelect);
      } else {
        // Regular input field for materials without fixed thickness
        const thicknessInput = document.createElement('input');
        thicknessInput.type = 'number';
        thicknessInput.classList.add('UCALC__input');
        thicknessInput.min = '0.1';
        thicknessInput.step = '0.1';
        thicknessInput.required = true;
        thicknessInput.addEventListener('change', handleThicknessChange);
        
        // Check if material has a lambda value at the material level
        // This has been pre-processed by the DataLoader
        if (material.lambda) {
          // Use the lambda value extracted during data processing
          layerContainer.dataset.lambda = material.lambda;
          console.log(`Using material-level lambda value: ${material.lambda}`);
          thicknessInput.disabled = false;
        } else {
          // Still no lambda found - this should be rare after our DataLoader changes
          console.error(`No lambda value found for material: ${materialId}`);
          thicknessInput.disabled = true;
        }
        
        // Add to container
        thicknessContainer.appendChild(thicknessInput);
      }
    } catch (error) {
      console.error("Error handling material selection:", error);
    }
    
    // Update calculation after material selection
    calculateResults();
  }
  
  // FUNCTION | Handle thickness selection for fixed thickness products
  // ------------------------------------------------------------
  function handleThicknessSelection(event) {
    const thicknessSelect = event.target;
    const layerContainer = thicknessSelect.closest('.UCALC__material-layer');
    const rValueDisplay = layerContainer.querySelector('.UCALC__r-value-display');
    
    // Get the selected option and its data
    const selectedOption = thicknessSelect.options[thicknessSelect.selectedIndex];
    const productVariantValue = thicknessSelect.value;
    
    console.log(`Selected thickness: ${selectedOption.textContent}`);
    
    if (!productVariantValue) {
      return;
    }
    
    // Extract productId and variantId from the compound value (format: "productId:variantId")
    const [productId, variantId] = productVariantValue.split(':');
    
    if (!productId || !variantId) {
      console.error(`Invalid product variant value: ${productVariantValue}`);
      return;
    }
    
    const lambda = parseFloat(selectedOption.dataset.lambda);
    let thickness = 0;
    
    // Extract thickness from the option text (e.g., "50mm")
    const thicknessMatch = selectedOption.textContent.match(/(\d+(?:\.\d+)?)mm/);
    if (thicknessMatch && thicknessMatch[1]) {
      thickness = parseFloat(thicknessMatch[1]);
    }
    
    if (thickness > 0 && lambda > 0) {
      // Store values for calculations
      layerContainer.dataset.lambda = lambda;
      layerContainer.dataset.thickness = thickness;
      
      // Calculate and store R-value
      const thicknessInMeters = thickness / 1000; // Convert mm to m
      const rValue = thicknessInMeters / lambda;
      layerContainer.dataset.rValue = rValue.toFixed(4);
      
      // Update R-value display
      if (rValueDisplay) {
        rValueDisplay.style.display = 'block';
        rValueDisplay.textContent = `R-value: ${rValue.toFixed(2)} m²K/W`;
      }
      
      console.log(`Set thickness: ${thickness}mm, lambda: ${lambda}, R-value: ${rValue}`);
    } else {
      console.error(`Invalid thickness or lambda value: thickness=${thickness}, lambda=${lambda}`);
    }
    
    // Update UI for calculation
    calculateResults();
  }
  
  // FUNCTION | Handle thickness change
  // ------------------------------------------------------------
  function handleThicknessChange(event) {
    const thicknessInput = event.target;
    const layerContainer = thicknessInput.closest('.UCALC__material-layer');
    
    // Only proceed if we have a thickness value
    if (!thicknessInput.value) {
      return;
    }
    
    // Update R-value display and layer data attribute
    updateRValueDisplay(layerContainer);
    
    // Update calculation after thickness change
    calculateResults();
  }
  
  // FUNCTION | Update R-value display based on thickness and lambda
  // ------------------------------------------------------------
  function updateRValueDisplay(layerContainer) {
    const thicknessInput = layerContainer.querySelector('.UCALC__input');
    const rValueDisplay = layerContainer.querySelector('.UCALC__r-value-display');
    
    // Get thickness and lambda
    const thickness = parseFloat(thicknessInput.value);
    const lambda = parseFloat(layerContainer.dataset.lambda);
    
    console.log(`Updating R-value with thickness=${thickness}, lambda=${lambda}`);
    
    if (!thickness || isNaN(thickness)) {
      console.warn("Invalid thickness value");
      rValueDisplay.textContent = 'R-value: -- m²K/W';
      return;
    }
    
    if (!lambda || isNaN(lambda)) {
      console.warn("Lambda value not found for this material");
      rValueDisplay.textContent = 'R-value: -- m²K/W';
      return;
    }
    
    // Convert thickness from mm to m for calculation
    const thicknessInMeters = thickness / 1000;
    
    // Use MathUtils to calculate R-value
    const rValue = thicknessInMeters / lambda;
    
    // Store calculated R-value in the layer data attribute for later use
    layerContainer.dataset.rValue = rValue.toFixed(4);
    
    // Update display
    if (rValueDisplay) {
      rValueDisplay.style.display = 'block';
      rValueDisplay.textContent = `R-value: ${rValue.toFixed(2)} m²K/W`;
    }
    
    console.log(`Updated R-value: ${rValue.toFixed(4)} m²K/W`);
  }
  
  // FUNCTION | Set up event listeners
  // ------------------------------------------------------------
  function setupEventListeners() {
    // Add event listener for form submission
    const form = document.getElementById(UI_CONFIG.ELEMENT_IDS.CONTROL_PANEL);
    if (form) {
      form.addEventListener('submit', handleFormSubmit);
    }
    
    // Add event listener for collapsible sections
    const caveatsSection = document.getElementById(UI_CONFIG.ELEMENT_IDS.CAVEATS_SECTION);
    if (caveatsSection) {
      caveatsSection.addEventListener('toggle', (event) => {
        // Toggle class for animation if needed
        if (event.target.open) {
          event.target.classList.add('UCALC__caveats-open');
        } else {
          event.target.classList.remove('UCALC__caveats-open');
        }
      });
    }
  }
  
  // FUNCTION | Calculate and display results
  // ------------------------------------------------------------
  function calculateResults() {
    console.log("Calculating results...");
    
    // Get all material layers
    const layers = [];
    
    // Get internal surface resistance
    const internalLayer = document.querySelector('.UCALC__fixed-layer[data-type="internal"]');
    if (internalLayer) {
      const rValue = parseFloat(internalLayer.dataset.rValue) || SURFACE_RESISTANCE.INTERNAL;
      layers.push({
        name: 'Internal Surface Resistance (Rsi)',
        rValue: rValue
      });
      console.log(`Added internal surface resistance: ${rValue}`);
    }
    
    // Get all material layers
    const materialLayers = document.querySelectorAll('.UCALC__material-layer');
    materialLayers.forEach((layer, index) => {
      const categorySelect = layer.querySelector('.UCALC__dropdown-container:nth-of-type(1) .UCALC__select');
      const materialSelect = layer.querySelector('.UCALC__dropdown-container:nth-of-type(2) .UCALC__select');
      
      // Find the thickness (either from input or select)
      const thicknessInput = layer.querySelector('.UCALC__input');
      const thicknessSelect = layer.querySelector('.UCALC__input-container .UCALC__select');
      
      // Get thickness from either the input field or select dropdown
      let hasThickness = false;
      let thickness = 0;
      
      if (thicknessInput && thicknessInput.value) {
        thickness = parseFloat(thicknessInput.value);
        hasThickness = true;
      } else if (thicknessSelect && thicknessSelect.value) {
        // For dropdown, thickness might be stored in the dataset
        if (layer.dataset.thickness) {
          thickness = parseFloat(layer.dataset.thickness);
          hasThickness = true;
        } else {
          // Try to extract from selected option text
          const selectedOption = thicknessSelect.options[thicknessSelect.selectedIndex];
          const thicknessMatch = selectedOption.textContent.match(/(\d+(?:\.\d+)?)mm/);
          if (thicknessMatch && thicknessMatch[1]) {
            thickness = parseFloat(thicknessMatch[1]);
            hasThickness = true;
          }
        }
      }
      
      // Only include if category and material are selected and thickness has a value
      if (categorySelect.value && materialSelect.value && hasThickness) {
        const categoryName = categorySelect.options[categorySelect.selectedIndex].text;
        const materialName = materialSelect.options[materialSelect.selectedIndex].text;
        
        // Get lambda
        const lambda = parseFloat(layer.dataset.lambda);
        
        // Calculate R-value if not already calculated
        let rValue = parseFloat(layer.dataset.rValue);
        
        if (!rValue && thickness && lambda) {
          const thicknessInMeters = thickness / 1000; // Convert mm to m
          rValue = thicknessInMeters / lambda;
          layer.dataset.rValue = rValue.toFixed(4);
        }
        
        if (rValue > 0) {
          layers.push({
            name: `${categoryName} - ${materialName}`,
            rValue: rValue
          });
          console.log(`Added layer ${index}: ${categoryName} - ${materialName}, R-value: ${rValue}`);
        } else {
          console.warn(`Layer ${index} has invalid R-value: ${rValue}`);
        }
      }
    });
    
    // Get external surface resistance
    const externalLayer = document.querySelector('.UCALC__fixed-layer[data-type="external"]');
    if (externalLayer) {
      const rValue = parseFloat(externalLayer.dataset.rValue) || SURFACE_RESISTANCE.EXTERNAL;
      layers.push({
        name: 'External Surface Resistance (Rse)',
        rValue: rValue
      });
      console.log(`Added external surface resistance: ${rValue}`);
    }
    
    // Only proceed if we have at least the surface resistances
    if (layers.length < 2) {
      console.warn("Not enough layers to calculate U-value");
      return;
    }
    
    // Calculate total R-value manually to avoid import issues
    let totalRValue = 0;
    layers.forEach(layer => {
      totalRValue += layer.rValue;
    });
    
    console.log(`Total R-value: ${totalRValue}`);
    
    // Calculate U-value manually to avoid import issues
    const uValue = 1 / totalRValue;
    console.log(`U-value: ${uValue}`);
    
    // Display results
    displayResults({ totalRValue, uValue, layers });
  }
  
  // FUNCTION | Display calculation results
  // ------------------------------------------------------------
  function displayResults(results) {
    const { totalRValue, uValue, layers } = results;
    
    // Display the formula
    const calculationDisplay = document.getElementById('calculation-display') || 
                              document.querySelector('.UCALC__calculation-display');
                              
    if (calculationDisplay) {
      let formulaHTML = '<h3>Calculation:</h3>';
      formulaHTML += '<div class="UCALC__formula">';
      formulaHTML += 'U = 1 / (';
      
      layers.forEach((layer, index) => {
        formulaHTML += `${layer.rValue.toFixed(2)}`;
        if (index < layers.length - 1) {
          formulaHTML += ' + ';
        }
      });
      
      formulaHTML += ') = 1 / ';
      formulaHTML += `${totalRValue.toFixed(2)} = ${uValue.toFixed(2)} W/m²K`;
      formulaHTML += '</div>';
      
      calculationDisplay.innerHTML = formulaHTML;
    }
    
    // Display the result
    const resultsDisplay = document.getElementById('results-display') || 
                             document.querySelector('.UCALC__results-display');
                             
    if (resultsDisplay) {
      resultsDisplay.innerHTML = `
        <h3>Results:</h3>
        <div class="UCALC__result-value">U-Value: ${uValue.toFixed(2)} W/m²K</div>
        <div class="UCALC__result-note">Total R-Value: ${totalRValue.toFixed(2)} m²K/W</div>
      `;
    }
  }
  
  // FUNCTION | Add a new material layer to the form
  // ------------------------------------------------------------
  function addMaterialLayer() {
    const layersContainer = document.getElementById(UI_CONFIG.ELEMENT_IDS.MATERIAL_LAYERS);
    const externalLayer = document.querySelector('.UCALC__fixed-layer[data-type="external"]');
    
    if (layersContainer && externalLayer) {
      // Create new material layer
      const newLayer = createMaterialLayer();
      
      // Insert before external surface resistance
      layersContainer.insertBefore(newLayer, externalLayer);
      
      // Update calculations
      calculateResults();
    }
  }
  
  // FUNCTION | Remove a material layer from the form
  // ------------------------------------------------------------
  function removeMaterialLayer(element) {
    // Count material layers
    const materialLayers = document.querySelectorAll('.UCALC__material-layer');
    
    // Don't allow removing if there's only one layer left
    if (materialLayers.length <= 1) {
      alert('You must keep at least one material layer.');
      return;
    }
    
    // Remove the layer
    element.remove();
    
    // Update calculations
    calculateResults();
  }
  
  // FUNCTION | Handle form submission
  // ------------------------------------------------------------
  function handleFormSubmit(event) {
    event.preventDefault();
    calculateResults();
  }