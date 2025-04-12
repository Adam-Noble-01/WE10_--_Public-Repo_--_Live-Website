/*
================================================================================
JAVASCRIPT |  DRAWING MANAGER
- Based on the reference implementation v1.8.8
DESCRIPTION
- Handles loading and managing drawings
- Manages drawing configuration and UI
================================================================================
*/

// Guard against multiple script execution
if (window._drawingManagerLoaded) {
    console.log("DRAWING_MANAGER: Already loaded, skipping initialization");
} else {
    window._drawingManagerLoaded = true;
    
    // Create namespace for this module
    window.drawingManager = window.drawingManager || {};
    
    // Module state
    let currentDrawing = null;
    const planImage = new Image();  // Changed to const to prevent redeclaration
    planImage.crossOrigin = "anonymous";
    let isImageLoaded = false;
    let naturalImageWidth = 0;
    let naturalImageHeight = 0;
    let currentDrawingScale = "1:50"; // Default scale if none provided
    let currentDrawingSize = "A1"; // Default size if none provided

    /**
     * Initialize the drawing manager
     */
    window.drawingManager.init = async function() {
        console.log("DRAWING_MANAGER: Initializing");
        
        try {
            // Check for toolbar element first
            let toolbar = document.getElementById("toolbar") || document.getElementById("TOOL__Container");
            if (!toolbar) {
                throw new Error("Required toolbar element not found. UI initialization may not be complete.");
            }

            // Fetch drawings data
            const drawings = await fetchDrawings();
            if (!drawings) {
                throw new Error("Failed to fetch drawings data");
            }

            // Create drawing buttons
            const buttonsCreated = createDrawingButtons(drawings);
            if (!buttonsCreated) {
                throw new Error("Failed to create drawing buttons");
            }
            
            // Load first drawing if available
            const firstDrawingKey = Object.keys(drawings).find(
                key => key.startsWith("drawing-") && drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}"
            );
            if (firstDrawingKey) {
                await loadDrawing(drawings[firstDrawingKey]);
            }
            
            console.log("DRAWING_MANAGER: Initialization complete");
            return true;
        } catch (error) {
            console.error("DRAWING_MANAGER: Error initializing:", error);
            return false;
        }
    };

    /**
     * Fetch drawings data from JSON configuration file
     */
    async function fetchDrawings() {
        const JSON_URL = "https://raw.githubusercontent.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/main/SN40_31_--_Web-App_-_PlanVision_-_Web-Assets-Library/SN40_-_DATA_-_Document-Library.json";
        try {
            const response = await fetch(JSON_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            console.log("DRAWING_MANAGER: Fetched data:", data);

            // Check for the existence of each nested level
            if (!data["na-project-data-library"]) {
                throw new Error("Missing 'na-project-data-library' in JSON");
            }
            if (!data["na-project-data-library"]["project-documentation"]) {
                throw new Error("Missing 'project-documentation' in JSON");
            }
            if (!data["na-project-data-library"]["project-documentation"]["project-drawings"]) {
                throw new Error("Missing 'project-drawings' in JSON");
            }

            const drawings = data["na-project-data-library"]["project-documentation"]["project-drawings"];
            return drawings;
        } catch (error) {
            console.error("DRAWING_MANAGER: Error fetching JSON:", error);
            showErrorMessage("Failed to load drawing data: " + error.message);
            return null;
        }
    }

    /**
     * Create drawing buttons in the toolbar
     */
    function createDrawingButtons(drawings) {
        console.log("DRAWING_MANAGER: Creating drawing buttons");
        
        try {
            // Get the toolbar element - try both IDs to support different versions
            let toolbar = document.getElementById("toolbar");
            if (!toolbar) {
                toolbar = document.getElementById("TOOL__Container");
            }
            
            if (!toolbar) {
                throw new Error("Toolbar element not found with either 'toolbar' or 'TOOL__Container' ID");
            }
            
            // Check if drawing buttons already exist
            const existingButtonContainer = document.querySelector(".drawing-button-container");
            if (existingButtonContainer) {
                console.log("DRAWING_MANAGER: Drawing buttons already exist, removing old ones");
                existingButtonContainer.remove();
                
                // Also remove any existing header
                const existingHeader = document.querySelector(".MENU__Drawing-Header-Text");
                if (existingHeader && existingHeader.textContent === "Select Drawing") {
                    existingHeader.remove();
                }
            }

            // Create header element for drawing section
            const header = document.createElement("div");
            header.className = "MENU__Drawing-Header-Text";
            header.textContent = "Select Drawing";

            // Create a separate container for the drawing buttons
            const buttonContainer = document.createElement("div");
            buttonContainer.className = "drawing-button-container";

            console.log("DRAWING_MANAGER: Found toolbar element:", toolbar);

            // Insert at the beginning of the toolbar
            if (toolbar.firstChild) {
                toolbar.insertBefore(buttonContainer, toolbar.firstChild);
                toolbar.insertBefore(header, buttonContainer);
            } else {
                toolbar.appendChild(header);
                toolbar.appendChild(buttonContainer);
            }

            // Add a spacer after the drawing buttons
            const spacer = document.createElement("div");
            spacer.style.marginBottom = "20px";
            buttonContainer.after(spacer);

            // Count how many buttons we create
            let buttonCount = 0;

            // Iterate over drawing entries and create buttons
            for (const key in drawings) {
                if (key.startsWith("drawing-") && drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}") {
                    const button = document.createElement("button");
                    button.className = "BTTN__Tool"; // Updated to match HTML/CSS convention
                    button.textContent = drawings[key]["document-name"];
                    button.addEventListener("click", () => loadDrawing(drawings[key]));
                    buttonContainer.appendChild(button);
                    buttonCount++;
                }
            }

            if (buttonCount === 0) {
                console.warn("DRAWING_MANAGER: No valid drawings found to create buttons for");
            } else {
                console.log(`DRAWING_MANAGER: Created ${buttonCount} drawing buttons`);
            }

            return true;
        } catch (error) {
            console.error("DRAWING_MANAGER: Error creating drawing buttons:", error);
            return false;
        }
    }

    /**
     * Load a specific drawing
     */
    async function loadDrawing(drawing) {
        showLoading();
        try {
            const pngUrl = drawing["document-links"]["png--github-link-url"];
            const pdfUrl = drawing["document-links"]["pdf--github-link-url"];
            const documentName = drawing["document-name"];
            const documentScale = drawing["document-scale"];
            const documentSize = drawing["document-size"];
            
            // Store drawing metadata for scale calculation
            currentDrawingScale = documentScale || "1:50"; // Default to 1:50 if not specified
            currentDrawingSize = documentSize || "A1"; // Default to A1 if not specified
            
            await loadPlanImage(pngUrl);
            isImageLoaded = true;
            currentDrawing = drawing;
            
            // Update UI
            updateDownloadLink(pdfUrl, documentName);
            if (window.canvasRenderer && typeof window.canvasRenderer.resetView === 'function') {
                window.canvasRenderer.resetView();
            }
            
            // Notify that drawing is loaded
            console.log("DRAWING_MANAGER: Drawing loaded, dispatching events");
            
            // Use the event manager if available, fall back to direct dispatch if not
            const eventDetail = {
                name: documentName,
                scale: documentScale,
                size: documentSize
            };
            
            // First dispatch drawingLoaded event
            if (window.eventListenerManager && typeof window.eventListenerManager.dispatchEvent === 'function') {
                window.eventListenerManager.dispatchEvent('drawingLoaded', eventDetail);
            } else {
                document.dispatchEvent(new CustomEvent('drawingLoaded', {
                    detail: eventDetail
                }));
            }
            
            // Then dispatch imageLoaded event directly for the canvas renderer
            const imageDetail = { 
                image: planImage,
                width: naturalImageWidth,
                height: naturalImageHeight
            };
            
            if (window.eventListenerManager && typeof window.eventListenerManager.dispatchEvent === 'function') {
                window.eventListenerManager.dispatchEvent('imageLoaded', imageDetail);
            } else {
                document.dispatchEvent(new CustomEvent('imageLoaded', {
                    detail: imageDetail
                }));
            }
            
            // Also dispatch assetsLoaded event for compatibility with Drawing-Management.js
            if (window.eventListenerManager && typeof window.eventListenerManager.dispatchEvent === 'function') {
                window.eventListenerManager.dispatchEvent('assetsLoaded', imageDetail);
            } else {
                document.dispatchEvent(new CustomEvent('assetsLoaded', {
                    detail: imageDetail
                }));
            }
            
            console.log("DRAWING_MANAGER: Events dispatched");
        } catch (error) {
            console.error("DRAWING_MANAGER: Error loading drawing:", error);
            showErrorMessage("Failed to load the selected drawing.");
        } finally {
            hideLoading();
        }
    }

    /**
     * Load the plan image asynchronously
     */
    function loadPlanImage(url) {
        return new Promise((resolve, reject) => {
            console.log("DRAWING_MANAGER: Loading plan image from URL:", url);
            
            // Clean up any previous failed state
            delete planImage.failedToLoad;
            
            // Set up a single timeout for loading detection
            const timeout = setTimeout(() => {
                if (!planImage.complete) {
                    console.warn("DRAWING_MANAGER: Image loading seems stalled, retrying");
                    const currentSrc = planImage.src;
                    planImage.src = "";  // Reset src to force a reload
                    setTimeout(() => {
                        planImage.src = currentSrc;
                    }, 200);
                }
            }, 5000); // 5 second timeout
            
            // Set up event handlers before setting src
            planImage.onload = () => {
                clearTimeout(timeout);
                console.log("DRAWING_MANAGER: Plan image loaded successfully");
                console.log("DRAWING_MANAGER: Image dimensions:", planImage.naturalWidth, "x", planImage.naturalHeight);
                naturalImageWidth = planImage.naturalWidth;
                naturalImageHeight = planImage.naturalHeight;
                isImageLoaded = true;
                
                // Force a redraw if canvas renderer is available
                if (window.canvasRenderer && typeof window.canvasRenderer.drawCanvas === 'function') {
                    console.log("DRAWING_MANAGER: Requesting canvas redraw");
                    requestAnimationFrame(window.canvasRenderer.drawCanvas);
                }
                
                resolve();
            };
            
            planImage.onerror = (err) => {
                clearTimeout(timeout);
                console.error("DRAWING_MANAGER: Failed to load plan image:", url, err);
                planImage.failedToLoad = true;
                isImageLoaded = false;
                reject(new Error("Failed to load plan image: " + url));
            };
            
            // Set crossOrigin before setting src
            planImage.crossOrigin = "anonymous";
            
            // Finally set the src to start loading
            planImage.src = url;
        });
    }

    /**
     * Update the PDF download button with the current drawing's link
     */
    function updateDownloadLink(pdfUrl, documentName) {
        const downloadBtn = document.getElementById("BTTN__Download-PDF");
        if (!downloadBtn) {
            console.warn("DRAWING_MANAGER: Download button not found");
            return;
        }
        
        downloadBtn.onclick = () => {
            const link = document.createElement("a");
            link.href = pdfUrl;
            link.download = documentName.replace(/ /g, "-") + ".pdf";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    }

    /**
     * Show loading overlay
     */
    function showLoading() {
        const loadingOverlay = document.getElementById('LOAD__Overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    /**
     * Hide loading overlay
     */
    function hideLoading() {
        const loadingOverlay = document.getElementById('LOAD__Overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    /**
     * Show error message
     */
    function showErrorMessage(message) {
        const errorElement = document.getElementById('NOTE__Error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Auto-hide after 8 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 8000);
        }
    }

    /**
     * Initialize drawing management - added from Drawing-Management.js
     * This function maintains compatibility with code expecting Drawing-Management.js
     */
    function initializeDrawingManagement() {
        console.log("DRAWING_MANAGEMENT: Initializing drawing management (compatibility layer)");
        
        if (window.drawingManager && window.drawingManager.isImageLoaded && window.drawingManager.isImageLoaded()) {
            console.log("DRAWING_MANAGEMENT: Image is loaded, proceeding with initialization");
            setupDrawingManagement();
        } else {
            console.warn("DRAWING_MANAGEMENT: Image not loaded yet");
            // Wait for image to be loaded
            document.addEventListener('drawingLoaded', setupDrawingManagement);
            document.addEventListener('assetsLoaded', setupDrawingManagement);
        }
    }

    /**
     * Setup drawing management - added from Drawing-Management.js
     * This function maintains compatibility with code expecting Drawing-Management.js
     */
    function setupDrawingManagement() {
        console.log("DRAWING_MANAGEMENT: Setting up drawing management (compatibility layer)");
        
        if (!window.drawingManager || !window.drawingManager.isImageLoaded()) {
            console.warn("DRAWING_MANAGEMENT: Cannot setup drawing management - image not loaded");
            return;
        }
        
        // Additional setup from Drawing-Management.js would go here
        console.log("DRAWING_MANAGEMENT: Setup complete");
    }

    // Expose necessary functions and variables
    window.drawingManager.loadDrawing = loadDrawing;
    window.drawingManager.getPlanImage = () => planImage;
    window.drawingManager.isImageLoaded = () => isImageLoaded;
    window.drawingManager.getNaturalImageWidth = () => naturalImageWidth;
    window.drawingManager.getNaturalImageHeight = () => naturalImageHeight;
    window.drawingManager.getCurrentDrawingScale = () => currentDrawingScale;
    window.drawingManager.getCurrentDrawingSize = () => currentDrawingSize;
    window.drawingManager.getCurrentDrawing = () => currentDrawing;
    window.drawingManager.getImageDimensions = () => ({width: naturalImageWidth, height: naturalImageHeight});

    // Register with module integration system
    if (window.moduleIntegration && typeof window.moduleIntegration.registerModuleReady === 'function') {
        window.moduleIntegration.registerModuleReady("drawingManager");
    }

    // Create compatibility layer for canvas renderer
    // The canvas renderer is looking for projectAssets but we have drawingManager
    window.projectAssets = {
        isImageLoaded: () => window.drawingManager.isImageLoaded(),
        getPlanImage: () => window.drawingManager.getPlanImage(),
        getNaturalImageWidth: () => window.drawingManager.getNaturalImageWidth(),
        getNaturalImageHeight: () => window.drawingManager.getNaturalImageHeight()
    };

    // Create compatibility layer for code expecting Drawing-Management.js functions
    window.masterAssetLoader = {
        isImageLoaded: () => window.drawingManager.isImageLoaded(),
        loadDrawing: (drawingId) => {
            // This is a simplified implementation that assumes drawingId is the same as in our data
            // In a real scenario, you might need to fetch drawings and find the right one
            console.log("COMPATIBILITY: Calling loadDrawing via masterAssetLoader compatibility layer", drawingId);
            return fetchDrawings().then(drawings => {
                const drawing = drawings[drawingId] || Object.values(drawings)[0];
                if (drawing) {
                    return loadDrawing(drawing);
                } else {
                    throw new Error("Drawing not found");
                }
            });
        },
        getImageDimensions: () => ({width: naturalImageWidth, height: naturalImageHeight})
    };

    // Expose the formerly separate Drawing-Management.js functions globally
    window.initializeDrawingManagement = initializeDrawingManagement;
    window.setupDrawingManagement = setupDrawingManagement;

    // Notify that drawing is loaded when drawing manager loads an image
    document.addEventListener('drawingLoaded', () => {
        // Dispatch an imageLoaded event for components that listen for it
        const planImage = window.drawingManager.getPlanImage();
        if (planImage) {
            console.log("DRAWING_MANAGER: Dispatching imageLoaded event");
            
            // Use event manager if available
            if (window.eventListenerManager && typeof window.eventListenerManager.dispatchEvent === 'function') {
                window.eventListenerManager.dispatchEvent('imageLoaded', { image: planImage });
            } else {
                document.dispatchEvent(new CustomEvent('imageLoaded', {
                    detail: { image: planImage }
                }));
            }
        }
    });

    // Only initialize on DOMContentLoaded once
    let initialized = false;
    const initOnDOMContentLoaded = () => {
        if (!initialized) {
            initialized = true;
            window.drawingManager.init().catch(error => {
                console.error("DRAWING_MANAGER: Error during initialization:", error);
            });
        }
    };
    
    // Check if DOM is already loaded
    if (document.readyState === 'loading') {
        // If not, add event listener
        document.addEventListener('DOMContentLoaded', initOnDOMContentLoaded);
    } else {
        // If it's already loaded, initialize immediately
        setTimeout(initOnDOMContentLoaded, 0);
    }

    // Log that this module has loaded
    console.log("DRAWING_MANAGER: Module loaded");
} 