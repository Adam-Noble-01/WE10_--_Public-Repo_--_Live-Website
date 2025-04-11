/*
================================================================================
JAVASCRIPT |  PROJECT ASSETS LOADER
- Introduced in v2.0.0
DESCRIPTION
- Loads project-specific drawing data from JSON repository
- Dynamically creates drawing selection buttons
- Handles loading of drawings and updating UI elements
================================================================================
*/

/*
--------------------------------------------
JAVASCRIPT |  PROJECT CONFIGURATION
- Introduced in v2.0.0
DESCRIPTION
- Configuration constants for project assets
IMPORTANT NOTES
- Update these paths if the project structure changes
--------------------------------------------
*/

// Default project data path - Updated to use local file
const PROJECT_DATA_PATH = "NA20_01_02_-_DATA_-_Document-Link-Library.json";

// Default drawing settings
const DEFAULT_DRAWING_SCALE = "1:50";
const DEFAULT_DRAWING_SIZE = "A1";

/*
--------------------------------------------
JAVASCRIPT |  DRAWING DATA MANAGEMENT
- Introduced in v2.0.0
DESCRIPTION
- Functions for fetching and managing drawing data
--------------------------------------------
*/

// Module-level variables
let planImage = new Image();
planImage.crossOrigin = "anonymous";
let currentDrawingScale = DEFAULT_DRAWING_SCALE;
let currentDrawingSize = DEFAULT_DRAWING_SIZE;
let naturalImageWidth = 0;
let naturalImageHeight = 0;
let isImageLoaded = false;

/**
 * Fetch drawings data from JSON configuration file
 */
async function fetchDrawings(jsonUrl = PROJECT_DATA_PATH) {
    try {
        console.log("Fetching drawing data from:", jsonUrl);
        const response = await fetch(jsonUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Fetched drawing data successfully, processing JSON structure...");

        // Try to extract drawings based on expected structure
        let drawings = null;
        
        // Try the standard nested structure first
        if (data["na-project-data-library"] && 
            data["na-project-data-library"]["project-documentation"] && 
            data["na-project-data-library"]["project-documentation"]["project-drawings"]) {
            
            drawings = data["na-project-data-library"]["project-documentation"]["project-drawings"];
            console.log("Found drawings in standard nested structure");
        } 
        // Try alternate structure - directly at top level
        else if (data["project-drawings"]) {
            drawings = data["project-drawings"];
            console.log("Found drawings at top-level project-drawings key");
        }
        // Try as a direct array of drawings
        else if (Array.isArray(data)) {
            drawings = {};
            data.forEach((item, index) => {
                drawings[`drawing-${index + 1}`] = item;
            });
            console.log("Found drawings as a direct array, converted to object structure");
        }
        // Try the data directly as a drawings object
        else if (typeof data === 'object' && data !== null) {
            // Check if the data itself has drawing-like properties
            let hasDrawingProperties = false;
            for (const key in data) {
                if (key.startsWith('drawing-') || 
                    (data[key] && (data[key]["document-name"] || data[key]["file-name"]))) {
                    hasDrawingProperties = true;
                    break;
                }
            }
            
            if (hasDrawingProperties) {
                drawings = data;
                console.log("Using raw JSON object as drawings collection");
            }
        }
        
        if (!drawings) {
            console.error("Could not locate drawings in JSON structure:", data);
            throw new Error("Drawing data not found in expected format");
        }
        
        console.log(`Found ${Object.keys(drawings).length} potential drawings`);
        return drawings;
    } catch (error) {
        console.error("Error fetching drawing data:", error.message);
        
        // Use placeholder drawings for local development if URL Parser is available
        if (window.urlParser && typeof window.urlParser.generatePlaceholderDrawings === 'function') {
            console.warn("Using placeholder drawings for local development");
            const placeholderData = window.urlParser.generatePlaceholderDrawings();
            
            if (placeholderData && placeholderData["project-drawings"]) {
                return placeholderData["project-drawings"];
            }
        }
        
        showErrorMessage("Failed to load drawing data: " + error.message);
        return null;
    }
}

/**
 * Create dynamic buttons for each drawing in the toolbar
 * Uses Project Specific JSON File to assign menu buttons
 */
function createDrawingButtons(drawings) {
    console.log("Creating drawing buttons...");
    
    // Create header element for drawing section
    const header = document.createElement("div");
    header.className = "MENU__Drawing-Header-Text";
    header.textContent = "Select Drawing";

    // Create a separate container for the drawing buttons
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "MENU__Drawing-Button-Container";

    // Get the toolbar element
    const toolbar = document.getElementById("TOOL__Container");
    
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

    // Count the number of buttons created for logging
    let buttonCount = 0;

    // Iterate over drawing entries and create buttons
    for (const key in drawings) {
        // Skip template entries or parse entries starting with drawing-
        if ((key.startsWith("drawing-") && 
             drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}") ||
            // Allow any entry with document-name (more flexible)
            drawings[key]["document-name"]) {
            
            const drawingName = drawings[key]["document-name"] || `Drawing ${++buttonCount}`;
            
            const button = document.createElement("button");
            button.className = "BTTN__Tool";
            button.textContent = drawingName;
            button.addEventListener("click", () => loadDrawing(drawings[key]));
            buttonContainer.appendChild(button);
            buttonCount++;
        }
    }
    
    console.log(`Created ${buttonCount} drawing buttons`);
}

/**
 * Load a specific drawing's image and update download link
 */
async function loadDrawing(drawing) {
    showLoadingOverlay();
    console.log("Loading drawing:", drawing);
    
    try {
        // Extract URLs from drawing
        let pngUrl = null;
        let pdfUrl = null;
        
        if (window.urlParser && typeof window.urlParser.extractUrls === "function") {
            // Use the URL Parser to extract URLs
            const urls = window.urlParser.extractUrls(drawing);
            pngUrl = urls.png;
            pdfUrl = urls.pdf;
            console.log("URLs extracted by URL Parser:", { pngUrl, pdfUrl });
        } else {
            // Fallback to manual extraction
            // Try to get the PNG URL from various possible locations
            if (drawing["document-links"] && drawing["document-links"]["png--github-link-url"]) {
                pngUrl = drawing["document-links"]["png--github-link-url"];
            } else if (drawing["png-url"] || drawing["png_url"] || drawing["pngUrl"]) {
                pngUrl = drawing["png-url"] || drawing["png_url"] || drawing["pngUrl"];
            } else if (drawing["url"] && drawing["url"].endsWith(".png")) {
                pngUrl = drawing["url"];
            } else if (drawing["image-url"] || drawing["image_url"] || drawing["imageUrl"]) {
                pngUrl = drawing["image-url"] || drawing["image_url"] || drawing["imageUrl"];
            }
            
            // Try to get the PDF URL from various possible locations
            if (drawing["document-links"] && drawing["document-links"]["pdf--github-link-url"]) {
                pdfUrl = drawing["document-links"]["pdf--github-link-url"];
            } else if (drawing["pdf-url"] || drawing["pdf_url"] || drawing["pdfUrl"]) {
                pdfUrl = drawing["pdf-url"] || drawing["pdf_url"] || drawing["pdfUrl"];
            } else if (drawing["url"] && drawing["url"].endsWith(".pdf")) {
                pdfUrl = drawing["url"];
            }
        }
        
        if (!pngUrl) {
            throw new Error("No PNG URL found for drawing");
        }
        
        // Get other metadata with fallbacks
        const documentName = drawing["document-name"] || drawing["name"] || "Unnamed Drawing";
        const documentScale = drawing["document-scale"] || drawing["scale"] || DEFAULT_DRAWING_SCALE;
        const documentSize = drawing["document-size"] || drawing["size"] || DEFAULT_DRAWING_SIZE;
        
        console.log(`Loading drawing ${documentName} from ${pngUrl}`);
        
        // Store drawing metadata for scale calculation
        currentDrawingScale = documentScale;
        currentDrawingSize = documentSize;
        
        await loadPlanImage(pngUrl);
        isImageLoaded = true;
        
        // Update the PDF download link if PDF URL is available
        if (pdfUrl) {
            updateDownloadLink(pdfUrl, documentName);
        } else {
            // Disable PDF download button if no PDF URL is available
            const downloadBtn = document.getElementById("BTTN__Download-PDF");
            if (downloadBtn) {
                downloadBtn.disabled = true;
            }
        }
        
        // Update UI with drawing title
        const drawingTitle = document.getElementById("DRWG__Name");
        if (drawingTitle) {
            drawingTitle.textContent = documentName;
        }
        
        // Update metadata display
        const scaleDisplay = document.getElementById("INPT__Scale");
        if (scaleDisplay) {
            scaleDisplay.textContent = documentScale;
        }
        
        const sizeDisplay = document.getElementById("INPT__Size");
        if (sizeDisplay) {
            sizeDisplay.textContent = documentSize;
        }
        
        // Check for measurement scaling availability and update
        if (window.measurementScaling && typeof window.measurementScaling.updateScaleFactors === "function") {
            window.measurementScaling.updateScaleFactors(documentScale, documentSize, naturalImageWidth);
        }
        
        // Dispatch event for drawing loaded with data
        document.dispatchEvent(new CustomEvent('drawingLoaded', {
            detail: {
                drawing: drawing,
                image: planImage,
                width: naturalImageWidth,
                height: naturalImageHeight,
                scale: documentScale,
                size: documentSize
            }
        }));
        
        // Update the canvas renderer if available
        if (window.canvasRenderer && typeof window.canvasRenderer.setCurrentImage === "function") {
            console.log("Updating Canvas Renderer with newly loaded image");
            window.canvasRenderer.setCurrentImage(planImage);
        }
        
        console.log(`Drawing ${documentName} loaded successfully`);
        hideLoadingOverlay();
        return true;
    } catch (error) {
        console.error("Error loading drawing:", error);
        showErrorMessage("Failed to load drawing: " + error.message);
        hideLoadingOverlay();
        return false;
    }
}

/**
 * Load the plan image asynchronously
 */
function loadPlanImage(url) {
    console.log("Loading image from URL:", url);
    
    return new Promise((resolve, reject) => {
        // Check if this is an HTML file (our fallback content)
        if (url.endsWith('.html')) {
            console.log("Loading HTML fallback content via iframe");
            
            // Create an iframe to load the HTML content
            const iframe = document.createElement('iframe');
            iframe.style.position = 'absolute';
            iframe.style.top = '0';
            iframe.style.left = '0';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.style.zIndex = '-1'; // Behind the canvas
            
            // Set up load event handlers
            iframe.onload = () => {
                console.log("HTML fallback content loaded successfully");
                
                // Set properties to mimic an image
                naturalImageWidth = 800;  // Match the SVG viewBox from our placeholders
                naturalImageHeight = 600;
                
                // Store iframe reference for use in rendering
                window.fallbackIframe = iframe;
                
                // Signal that we're using fallback content
                window.usingFallbackContent = true;
                
                // Hide the actual iframe to avoid conflicts
                iframe.style.opacity = '0';
                
                // Resolve the promise
                resolve();
            };
            
            iframe.onerror = (e) => {
                console.error("Error loading HTML fallback content:", e);
                reject(new Error("Failed to load HTML fallback content"));
            };
            
            // Add the iframe to the document
            document.body.appendChild(iframe);
            
            // Set the source to load the HTML
            iframe.src = url;
            return;
        }
        
        // For regular images, use the standard approach
        // Add progress tracking
        let loadStartTime = Date.now();
        let loadCheckInterval = setInterval(() => {
            const elapsed = (Date.now() - loadStartTime) / 1000;
            console.log(`Image loading... (${elapsed.toFixed(1)}s elapsed)`);
            if (elapsed > 30) {  // After 30 seconds, stop checking
                clearInterval(loadCheckInterval);
            }
        }, 2000);
        
        // Create a new image for better control
        const newImage = new Image();
        newImage.crossOrigin = "anonymous";
        
        // When the image loads successfully
        newImage.onload = () => {
            clearInterval(loadCheckInterval);
            console.log("✅ IMAGE LOADED SUCCESSFULLY in loadPlanImage function");
            console.log(`Image details: ${newImage.width}x${newImage.height} (natural: ${newImage.naturalWidth}x${newImage.naturalHeight})`);
            
            // Copy properties to the planImage
            planImage.src = newImage.src;
            naturalImageWidth = newImage.naturalWidth;
            naturalImageHeight = newImage.naturalHeight;
            
            // Signal that we're using a regular image
            window.usingFallbackContent = false;
            
            // Wait for planImage to update
            setTimeout(() => {
                console.log("⚡ Resolving loadPlanImage promise after successful load");
                // Force an immediate dispatch of drawing-related events
                notifyImageLoaded();
                resolve();
            }, 100);
        };
        
        // When there's an error loading the image
        newImage.onerror = (e) => {
            clearInterval(loadCheckInterval);
            console.error("❌ Error loading image:", e);
            console.error("Failed image URL:", url);
            // Try using direct assignment as a fallback
            planImage.src = url;
            planImage.onload = () => {
                console.log("✅ Fallback image load succeeded");
                naturalImageWidth = planImage.naturalWidth;
                naturalImageHeight = planImage.naturalHeight;
                resolve();
            };
            planImage.onerror = () => {
                console.error("❌ Fallback image load also failed");
                reject(new Error("Failed to load plan image: " + url));
            };
        };
        
        // Start loading the image
        console.log("⏳ Starting to load image from URL:", url);
        newImage.src = url;
    });
}

/**
 * Notify that an image has been loaded successfully
 */
function notifyImageLoaded() {
    console.log("📢 Dispatching imageLoaded event");
    document.dispatchEvent(new CustomEvent('imageLoaded', {
        detail: {
            image: planImage,
            width: naturalImageWidth,
            height: naturalImageHeight
        }
    }));
    
    // Also manually update the Canvas Renderer if available
    if (window.canvasRenderer && typeof window.canvasRenderer.setCurrentImage === "function") {
        console.log("🖼️ Directly updating Canvas Renderer with loaded image");
        window.canvasRenderer.setCurrentImage(planImage);
    }
}

/**
 * Update the PDF download button with the current drawing's link
 */
function updateDownloadLink(pdfUrl, documentName) {
    const downloadBtn = document.getElementById("BTTN__Download-PDF");
    if (!downloadBtn) {
        console.error("Download button not found");
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

/*
--------------------------------------------
JAVASCRIPT |  UI UTILITY FUNCTIONS
- Introduced in v2.0.0
DESCRIPTION
- Helper functions for UI manipulation
--------------------------------------------
*/

/**
 * Show the loading overlay
 */
function showLoadingOverlay() {
    const loadingOverlay = document.getElementById("LOAD__Overlay");
    if (loadingOverlay) {
        loadingOverlay.classList.remove("LOAD__Overlay--hidden");
    }
}

/**
 * Hide the loading overlay
 */
function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById("LOAD__Overlay");
    if (loadingOverlay) {
        loadingOverlay.classList.add("LOAD__Overlay--hidden");
    }
}

/**
 * Display an error message to the user
 */
function showErrorMessage(message) {
    const errorElement = document.getElementById("NOTE__Error");
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = "block";
    }
}

/*
--------------------------------------------
JAVASCRIPT |  INITIALIZATION
- Introduced in v2.0.0
DESCRIPTION
- Initializes the project assets loading
--------------------------------------------
*/

/**
 * Initialize project assets once the app assets are loaded
 */
async function initProjectAssets() {
    console.log("Initializing project assets...");
    showLoadingOverlay();
    
    try {
        // Fetch drawings data from JSON
        const drawings = await fetchDrawings();
        
        if (drawings) {
            // Create buttons for each drawing
            createDrawingButtons(drawings);
            
            // Load the first drawing by default
            const firstDrawingKey = Object.keys(drawings).find(
                key => key.startsWith("drawing-") && drawings[key]["file-name"] !== "{{TEMPLATE_-_ENTRY_-_TO_-_COPY_-_DO_-_NOT_-_DELETE}}"
            );
            
            if (firstDrawingKey) {
                await loadDrawing(drawings[firstDrawingKey]);
            } else {
                console.warn("No valid drawings found in the JSON data");
                showErrorMessage("No drawings found to display");
            }
        } else {
            showErrorMessage("Failed to load drawing data");
        }
    } catch (error) {
        console.error("Error initializing project assets:", error);
        showErrorMessage("Failed to initialize project assets");
    } finally {
        hideLoadingOverlay();
    }
    
    // Make key functions available to other modules
    window.projectAssets = {
        getCurrentDrawingScale: () => currentDrawingScale,
        getCurrentDrawingSize: () => currentDrawingSize,
        getPlanImage: () => planImage,
        getNaturalImageWidth: () => naturalImageWidth,
        getNaturalImageHeight: () => naturalImageHeight,
        isImageLoaded: () => isImageLoaded,
        loadDrawing: loadDrawing
    };
    
    // Signal that project assets are ready
    document.dispatchEvent(new CustomEvent('projectAssetsReady'));
    
    return { success: true };
}

// Wait for app assets to be loaded before initializing project assets
document.addEventListener('assetsLoaded', () => {
    console.log("App assets loaded, initializing project assets");
    initProjectAssets();
}); 