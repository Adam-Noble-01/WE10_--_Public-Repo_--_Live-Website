/**
 * Central module for managing DOM element references
 * This provides a single source of truth for element selectors
 */

// Initialize DOM elements when the document is loaded
function initDOMElements() {
    // Main UI buttons
    const elements = {
        btnScan: document.getElementById('btn-scan'),
        btnExport: document.getElementById('btn-export'),
        
        // Input fields
        inputDir: document.getElementById('input-dir'),
        inputDepth: document.getElementById('input-depth'),
        inputJson: document.getElementById('input-json'),
        enableJsonExport: document.getElementById('enable-json-export'),
        
        // Containers and status elements
        jsonExportOptions: document.getElementById('json-export-options'),
        statusText: document.getElementById('status-text'),
        loadingIndicator: document.getElementById('loading'),
        previewTree: document.getElementById('preview-tree'),
        exportStatus: document.getElementById('export-status'),
        
        // Error display elements
        dirError: document.getElementById('input-dir-error'),
        depthError: document.getElementById('input-depth-error'),
        jsonError: document.getElementById('input-json-error')
    };
    
    // Check that all elements were found
    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`DOM element not found: ${key}`);
        }
    }
    
    return elements;
}

/**
 * Sets up the JSON export toggle functionality
 * @param {Object} elements - Object containing DOM element references
 * @param {Object} state - Application state object to update
 */
function setupJsonExportToggle(elements, state) {
    const { enableJsonExport, jsonExportOptions, btnExport } = elements;
    
    enableJsonExport.addEventListener('change', () => {
        jsonExportOptions.style.display = enableJsonExport.checked ? 'block' : 'none';
        
        if (state.scanData && enableJsonExport.checked) {
            btnExport.style.display = 'inline-block';
            btnExport.disabled = false;
        } else {
            btnExport.style.display = enableJsonExport.checked ? 'inline-block' : 'none';
            btnExport.disabled = true;
        }
    });
}

/**
 * Shows or hides the loading indicator
 * @param {Object} elements - DOM elements object
 * @param {boolean} isLoading - Whether to show (true) or hide (false) the loading indicator
 */
function setLoadingState(elements, isLoading) {
    elements.loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    elements.btnScan.disabled = isLoading;
}

/**
 * Updates the status text
 * @param {Object} elements - DOM elements object
 * @param {string} message - Status message to display
 */
function updateStatus(elements, message) {
    elements.statusText.textContent = message;
}

/**
 * Resets all error messages
 * @param {Object} elements - DOM elements object
 */
function clearErrors(elements) {
    elements.dirError.textContent = '';
    elements.depthError.textContent = '';
    elements.jsonError.textContent = '';
    elements.exportStatus.textContent = '';
}

/**
 * Updates the export status message
 * @param {Object} elements - DOM elements object
 * @param {string} message - Status message
 * @param {boolean} isError - Whether this is an error message
 */
function updateExportStatus(elements, message, isError = false) {
    elements.exportStatus.textContent = message;
    elements.exportStatus.className = isError ? 'export-status error-text' : 'export-status success-text';
}

export { 
    initDOMElements, 
    setupJsonExportToggle,
    setLoadingState,
    updateStatus,
    clearErrors,
    updateExportStatus
}; 