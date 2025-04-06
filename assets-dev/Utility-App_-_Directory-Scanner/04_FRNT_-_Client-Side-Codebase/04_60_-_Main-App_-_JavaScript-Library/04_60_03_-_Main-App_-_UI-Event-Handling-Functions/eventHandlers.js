import { validateScanForm, validateExportForm, displayServerErrors } from '../04_60_90_-_Main-App_-__Error-Handling-Functions/formValidation.js';
import { startScan, exportToJson } from '../04_60_04_-_Main-App_-_System-Level-API-Functions/apiClient.js';
import { setLoadingState, updateStatus, clearErrors, updateExportStatus } from '../04_60_05_-_Main-App_-_DOM-Interaction-Functions/domElements.js';
import { renderDirectoryTree } from '../04_60_29_-_Main-App_-_UI-Rendering-Functions/treeRenderer.js';

/**
 * Sets up the scan button click handler
 * @param {Object} elements - DOM elements object
 * @param {Object} state - Application state object
 */
function setupScanButtonHandler(elements, state) {
    const {
        btnScan,
        btnExport,
        inputDir,
        inputDepth,
        inputJson,
        enableJsonExport,
        previewTree
    } = elements;

    btnScan.addEventListener('click', async () => {
        // Reset UI and state
        setLoadingState(elements, true);
        updateStatus(elements, 'Validating inputs...');
        previewTree.innerHTML = '<p>Scanning...</p>';
        clearErrors(elements);
        state.scanData = null;
        btnExport.disabled = true;
        
        // Get input values
        const dirPath = inputDir.value.trim();
        const depth = inputDepth.value.trim();
        const jsonExportEnabled = enableJsonExport.checked;
        const jsonPath = jsonExportEnabled ? inputJson.value.trim() : '';
        
        // Client-side validation
        const validation = validateScanForm(
            { dirPath, depth, jsonExportEnabled, jsonPath },
            elements
        );
        
        if (!validation.valid) {
            updateStatus(elements, 'Validation failed. Check errors above.');
            setLoadingState(elements, false);
            return;
        }
        
        // Set up callbacks for the scan process
        const callbacks = {
            onProgress: (message) => {
                updateStatus(elements, message);
                // If called without arguments, return current status (used in end_stream)
                if (!message) return elements.statusText.textContent;
                return null;
            },
            onComplete: (result) => {
                state.scanData = result;
                renderDirectoryTree(result, previewTree);
                setLoadingState(elements, false);
                
                // Enable export button if JSON export is enabled
                if (jsonExportEnabled) {
                    btnExport.style.display = 'inline-block';
                    btnExport.disabled = false;
                }
            },
            onError: (message) => {
                previewTree.innerHTML = `<p style="color: red;">Error during scan: ${message}</p>`;
                updateStatus(elements, `Scan failed: ${message}`);
                setLoadingState(elements, false);
            }
        };
        
        // Start the scan
        const scanResult = await startScan(
            { dirPath, depth, jsonExportEnabled, jsonPath },
            callbacks
        );
        
        if (!scanResult.success) {
            // Handle API errors
            displayServerErrors(scanResult.errors, elements, jsonExportEnabled);
            setLoadingState(elements, false);
            previewTree.innerHTML = '<p>Scan failed to start.</p>';
        }
    });
}

/**
 * Sets up the export button click handler
 * @param {Object} elements - DOM elements object
 * @param {Object} state - Application state object
 */
function setupExportButtonHandler(elements, state) {
    const { btnExport, inputJson } = elements;
    
    btnExport.addEventListener('click', async () => {
        // Validate export parameters
        const outputPath = inputJson.value.trim();
        const validation = validateExportForm(
            { scanData: state.scanData, outputPath },
            elements
        );
        
        if (!validation.valid) {
            updateExportStatus(elements, `Error: ${validation.error}`, true);
            if (validation.error.includes('output file path')) {
                inputJson.focus();
            }
            return;
        }
        
        // Update UI for export
        updateExportStatus(elements, 'Exporting...');
        btnExport.disabled = true;
        
        // Set up callbacks
        const callbacks = {
            onSuccess: (message) => {
                updateExportStatus(elements, message);
                setTimeout(() => {
                    btnExport.disabled = false;
                }, 1500);
            },
            onError: (message) => {
                updateExportStatus(elements, message, true);
                btnExport.disabled = false;
            }
        };
        
        // Start export
        await exportToJson(
            { scanData: state.scanData, outputPath },
            callbacks
        );
    });
}

export { 
    setupScanButtonHandler, 
    setupExportButtonHandler 
}; 