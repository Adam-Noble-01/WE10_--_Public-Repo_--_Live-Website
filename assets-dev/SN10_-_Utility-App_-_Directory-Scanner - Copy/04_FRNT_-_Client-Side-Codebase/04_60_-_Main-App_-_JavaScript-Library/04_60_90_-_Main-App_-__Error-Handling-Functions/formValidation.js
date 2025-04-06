/**
 * Module for handling form validation
 */

/**
 * Validates scan form inputs
 * @param {Object} formData - Form data to validate
 * @param {Object} elements - DOM elements for displaying errors
 * @returns {Object} - Validation result { valid: boolean, errors: Object }
 */
function validateScanForm(formData, elements) {
    const { dirPath, depth, jsonExportEnabled, jsonPath } = formData;
    const { dirError, depthError, jsonError } = elements;
    
    let hasError = false;
    
    // Clear previous errors
    dirError.textContent = '';
    depthError.textContent = '';
    jsonError.textContent = '';
    
    // Validate directory path
    if (!dirPath) {
        dirError.textContent = 'Directory path cannot be empty.';
        hasError = true;
    }
    
    // Validate depth
    if (depth && isNaN(parseInt(depth))) {
        depthError.textContent = 'Max depth must be a number.';
        hasError = true;
    } else if (depth && parseInt(depth) < 0) {
        depthError.textContent = 'Max depth must be non-negative.';
        hasError = true;
    }
    
    // Validate JSON path if export is enabled
    if (jsonExportEnabled) {
        if (!jsonPath) {
            jsonError.textContent = 'Output JSON file path cannot be empty when export is enabled.';
            hasError = true;
        } else if (!jsonPath.includes('.') || jsonPath.endsWith('/') || jsonPath.endsWith('\\')) {
            jsonError.textContent = 'Please provide a valid file path with filename and extension.';
            hasError = true;
        }
    }
    
    return {
        valid: !hasError,
        errors: {
            directory_path: dirError.textContent,
            max_depth: depthError.textContent,
            output_path: jsonError.textContent
        }
    };
}

/**
 * Validates export form inputs
 * @param {Object} exportData - Export data to validate
 * @param {Object} elements - DOM elements for displaying errors
 * @returns {Object} - Validation result { valid: boolean, error: string }
 */
function validateExportForm(exportData, elements) {
    const { scanData, outputPath } = exportData;
    const { jsonError } = elements;
    
    // Clear previous errors
    jsonError.textContent = '';
    
    // Validate scan data
    if (!scanData) {
        return {
            valid: false,
            error: 'No scan data available to export.'
        };
    }
    
    // Validate output path
    if (!outputPath) {
        jsonError.textContent = 'Output JSON file path is required for export.';
        return {
            valid: false,
            error: 'Please specify the output JSON file path.'
        };
    } 
    
    if (!outputPath.includes('.') || outputPath.endsWith('/') || outputPath.endsWith('\\')) {
        jsonError.textContent = 'Please provide a valid file path with filename and extension.';
        return {
            valid: false,
            error: 'Invalid output file path format.'
        };
    }
    
    return {
        valid: true
    };
}

/**
 * Displays server-side validation errors
 * @param {Object} errors - Error object from the server
 * @param {Object} elements - DOM elements for displaying errors
 * @param {boolean} jsonExportEnabled - Whether JSON export is enabled
 */
function displayServerErrors(errors, elements, jsonExportEnabled) {
    const { dirError, depthError, jsonError, statusText } = elements;
    
    if (!errors) return;
    
    // Display field-specific errors
    if (errors.directory_path) {
        dirError.textContent = errors.directory_path;
    }
    
    if (errors.max_depth) {
        depthError.textContent = errors.max_depth;
    }
    
    if (jsonExportEnabled && errors.output_path) {
        jsonError.textContent = errors.output_path;
    }
    
    // Display global error
    if (errors._global) {
        statusText.textContent = errors._global;
    } else {
        statusText.textContent = 'Validation failed. Check errors above.';
    }
}

export {
    validateScanForm,
    validateExportForm,
    displayServerErrors
}; 