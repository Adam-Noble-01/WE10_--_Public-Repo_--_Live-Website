/*
================================================================================
JAVASCRIPT |  MEASUREMENT TOOL BUTTON HANDLERS
- Introduced in v2.0.0
DESCRIPTION
- Handles button click events and callbacks for measurement tools
- Links UI buttons to measurement tool functions
================================================================================
*/

/*
------------------------------------------------------------
JAVASCRIPT |  BUTTON EVENT LISTENERS
- Introduced in v2.0.0
DESCRIPTION
- Sets up event listeners for measurement tool buttons
------------------------------------------------------------
*/

// FUNCTION | Initialize measurement tool button handlers
// --------------------------------------------------------- //
function initMeasurementButtonHandlers() {
    // Linear measurement button
    const linearMeasureBtn = document.getElementById('BTTN__Linear-Measure');
    if (linearMeasureBtn) {
        linearMeasureBtn.addEventListener('click', () => {
            deactivateAllTools();
            MeasurementTools.activateLinearMeasurementTool();
            updateToolInstructions('Click to start measuring. Click again to set end point.');
        });
    }

    // Rectangle measurement button
    const rectMeasureBtn = document.getElementById('BTTN__Rect-Measure');
    if (rectMeasureBtn) {
        rectMeasureBtn.addEventListener('click', () => {
            deactivateAllTools();
            MeasurementTools.activateRectangleMeasurementTool();
            updateToolInstructions('Click to set first corner. Click again to set opposite corner.');
        });
    }

    // Area measurement button
    const areaMeasureBtn = document.getElementById('BTTN__Area-Measure');
    if (areaMeasureBtn) {
        areaMeasureBtn.addEventListener('click', () => {
            deactivateAllTools();
            MeasurementTools.activateAreaMeasurementTool();
            updateToolInstructions('Click to start area. Click for each point. Double-click to finish.');
        });
    }

    // Clear measurements button
    const clearMeasureBtn = document.getElementById('BTTN__Clear-Measurements');
    if (clearMeasureBtn) {
        clearMeasureBtn.addEventListener('click', () => {
            MeasurementTools.clearAllMeasurements();
            updateToolInstructions('All measurements cleared.');
            setTimeout(() => hideToolInstructions(), 2000);
        });
    }

    // Cancel tool button
    const cancelToolBtn = document.getElementById('BTTN__Cancel-Tool');
    if (cancelToolBtn) {
        cancelToolBtn.addEventListener('click', () => {
            deactivateAllTools();
            MeasurementTools.cancelActiveTool();
            hideToolInstructions();
        });
    }

    // Finish measurement button
    const finishMeasureBtn = document.getElementById('BTTN__Finish-Measurement');
    if (finishMeasureBtn) {
        finishMeasureBtn.addEventListener('click', () => {
            MeasurementTools.completeMeasurement();
            hideToolInstructions();
        });
    }
}

/*
------------------------------------------------------------
JAVASCRIPT |  TOOL INSTRUCTION HANDLERS
- Introduced in v2.0.0
DESCRIPTION
- Manages the tool instruction overlay
------------------------------------------------------------
*/

// FUNCTION | Update tool instructions
// --------------------------------------------------------- //
function updateToolInstructions(text) {
    const instructionsText = document.getElementById('TOOL__Instructions-Text');
    const instructionsOverlay = document.getElementById('TOOL__Instructions-Overlay');
    
    if (instructionsText && instructionsOverlay) {
        instructionsText.textContent = text;
        instructionsOverlay.style.display = 'block';
    }
}

// FUNCTION | Hide tool instructions
// --------------------------------------------------------- //
function hideToolInstructions() {
    const instructionsOverlay = document.getElementById('TOOL__Instructions-Overlay');
    if (instructionsOverlay) {
        instructionsOverlay.style.display = 'none';
    }
}

/*
------------------------------------------------------------
JAVASCRIPT |  TOOL STATE MANAGEMENT
- Introduced in v2.0.0
DESCRIPTION
- Manages the active state of measurement tools
------------------------------------------------------------
*/

// FUNCTION | Deactivate all tools
// --------------------------------------------------------- //
function deactivateAllTools() {
    // Remove active class from all tool buttons
    const toolButtons = document.querySelectorAll('.BTTN__Tool');
    toolButtons.forEach(button => button.classList.remove('active'));
    
    // Hide the finish measurement button
    const finishBtn = document.getElementById('BTTN__Finish-Measurement');
    if (finishBtn) {
        finishBtn.style.display = 'none';
    }
}

// Initialize button handlers when DOM is loaded
document.addEventListener('DOMContentLoaded', initMeasurementButtonHandlers); 