import { initDOMElements, setupJsonExportToggle } from '../04_60_05_-_Main-App_-_DOM-Interaction-Functions/domElements.js';
import { setupScanButtonHandler, setupExportButtonHandler } from '../04_60_03_-_Main-App_-_UI-Event-Handling-Functions/eventHandlers.js';

/**
 * Initializes the application when the DOM is loaded
 */
function initApp() {
    console.log('Initializing Directory Scanner application...');
    
    // Application state
    const state = {
        scanData: null,
    };
    
    try {
        // Initialize DOM elements
        const elements = initDOMElements();
        
        // Check that critical elements exist
        if (!elements.btnScan || !elements.previewTree) {
            console.error('Critical DOM elements missing. Cannot initialize app.');
            return;
        }
        
        // Set up UI interactions
        setupJsonExportToggle(elements, state);
        setupScanButtonHandler(elements, state);
        setupExportButtonHandler(elements, state);
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
    }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);

// Export for testing or external initialization
export { initApp }; 