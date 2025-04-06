/**
 * Module for handling API calls to the server
 */

// Module-level state for SSE connection
let currentEventSource = null;
let currentScanId = null;

/**
 * Starts a directory scan by calling the API
 * @param {Object} scanParams - Parameters for the scan
 * @param {Function} callbacks - Object containing callback functions
 * @returns {Promise<Object>} - Promise resolving to the scan result
 */
async function startScan(scanParams, callbacks) {
    const { dirPath, depth, jsonExportEnabled, jsonPath } = scanParams;
    const { onProgress, onComplete, onError } = callbacks;
    
    // Prepare request body
    const requestBody = {
        directory_path: dirPath,
        max_depth: depth
    };
    
    // Only include output_path if JSON export is enabled
    if (jsonExportEnabled && jsonPath) {
        requestBody.output_path = jsonPath;
    }
    
    try {
        // Make the API call
        const response = await fetch('/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        if (!response.ok) {
            // Return error information
            return { 
                success: false, 
                errors: result.errors || { _global: result.error || response.statusText } 
            };
        } else {
            // Scan started successfully
            currentScanId = result.scan_id;
            connectToSSE(currentScanId, callbacks);
            return { success: true, scanId: currentScanId };
        }
    } catch (error) {
        console.error("Error calling /scan:", error);
        return { 
            success: false, 
            errors: { _global: `Failed to initiate scan: ${error.message}` } 
        };
    }
}

/**
 * Connects to Server-Sent Events for real-time scan updates
 * @param {string} scanId - ID of the scan to monitor
 * @param {Object} callbacks - Callback functions for events
 */
function connectToSSE(scanId, callbacks) {
    const { onProgress, onComplete, onError } = callbacks;
    
    // Close any existing SSE connection
    closeSSE();
    
    // Update the status text
    onProgress(`Connecting to status stream for scan ${scanId.substring(0, 8)}...`);
    
    // Create a new EventSource
    currentEventSource = new EventSource(`/status/${scanId}`);

    // Set up event handlers
    currentEventSource.onopen = () => {
        onProgress(`Connected, waiting for scan updates...`);
    };

    currentEventSource.onmessage = (event) => {
        console.debug("SSE message received:", event.data);
        
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'progress':
                    onProgress(`Scanning: ${data.path}`);
                    break;
                    
                case 'complete':
                    onProgress('Scan complete!');
                    onComplete(data.result);
                    closeSSE();
                    break;

                case 'error':
                    onError(data.message);
                    closeSSE();
                    break;
                    
                default:
                    console.warn("Unknown SSE message type:", data.type, data);
            }
        } catch (e) {
            console.error("Error parsing SSE data:", e, "Raw data:", event.data);
            onError(`Received unparsable data: ${event.data}`);
        }
    };

    currentEventSource.addEventListener('end_stream', (event) => {
        console.log("SSE server signaled end of stream:", event.data);
        closeSSE();
        
        // Check for unexpected stream endings
        if (onProgress) {
            const currentStatus = onProgress();
            if (currentStatus && currentStatus.toLowerCase().includes('scanning')) {
                onError('Scan stream ended unexpectedly.');
            } else if (currentStatus && currentStatus.toLowerCase().includes('connecting')) {
                onError('Failed to receive scan status.');
            }
        }
    });

    currentEventSource.onerror = (error) => {
        console.error("SSE connection error:", error);
        let isFatal = !currentEventSource || currentEventSource.readyState === EventSource.CLOSED;
        onError(`Status stream connection error${isFatal ? ' (closed)' : ''}.`);
        
        if (isFatal && currentEventSource) {
            closeSSE();
        }
    };
}

/**
 * Closes the current SSE connection if one exists
 */
function closeSSE() {
    if (currentEventSource) {
        currentEventSource.close();
        console.log(`SSE connection closed for scan ${currentScanId}`);
        currentEventSource = null;
    }
}

/**
 * Exports scan data to a JSON file
 * @param {Object} exportParams - Parameters for export
 * @param {Object} callbacks - Callback functions
 * @returns {Promise<Object>} - Promise resolving to the export result
 */
async function exportToJson(exportParams, callbacks) {
    const { scanData, outputPath } = exportParams;
    const { onSuccess, onError } = callbacks;
    
    try {
        const response = await fetch('/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                scan_data: scanData,
                output_path: outputPath
            })
        });

        const result = await response.json();

        if (!response.ok) {
            onError(`Error exporting: ${result.error || response.statusText}`);
            return { 
                success: false, 
                error: result.error || response.statusText 
            };
        } else {
            onSuccess(result.message || 'Export successful!');
            return { 
                success: true, 
                message: result.message 
            };
        }
    } catch (error) {
        console.error("Error calling /export:", error);
        onError(`Export failed: ${error.message}`);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

export { 
    startScan, 
    connectToSSE, 
    closeSSE, 
    exportToJson 
}; 