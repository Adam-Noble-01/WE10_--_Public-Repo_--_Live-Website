function initializeDrawingManagement() {
    console.log("DRAWING_MANAGEMENT: Initializing drawing management");
    
    if (window.masterAssetLoader && window.masterAssetLoader.isImageLoaded && window.masterAssetLoader.isImageLoaded()) {
        console.log("DRAWING_MANAGEMENT: Image is loaded, proceeding with initialization");
        setupDrawingManagement();
    } else {
        console.warn("DRAWING_MANAGEMENT: Image not loaded yet");
        // Wait for image to be loaded
        document.addEventListener('assetsLoaded', onImageLoaded);
    }
}

function onImageLoaded(event) {
    console.log("DRAWING_MANAGEMENT: Image loaded event received");
    if (window.masterAssetLoader && window.masterAssetLoader.isImageLoaded && window.masterAssetLoader.isImageLoaded()) {
        console.log("DRAWING_MANAGEMENT: Image is loaded, proceeding with initialization");
        setupDrawingManagement();
    } else {
        console.warn("DRAWING_MANAGEMENT: Image not loaded yet");
    }
}

function setupDrawingManagement() {
    console.log("DRAWING_MANAGEMENT: Setting up drawing management");
    
    if (!window.masterAssetLoader || !window.masterAssetLoader.isImageLoaded()) {
        console.warn("DRAWING_MANAGEMENT: Cannot setup drawing management - image not loaded");
        return;
    }
    
    // Get image dimensions from masterAssetLoader
    const imageDimensions = window.masterAssetLoader.getImageDimensions();
    if (!imageDimensions) {
        console.warn("DRAWING_MANAGEMENT: Cannot setup drawing management - no image dimensions");
        return;
    }
    
    // ... existing code ...
}

// ... existing code ...
function loadDrawing(drawingId) {
    console.log("DRAWING_MANAGEMENT: Loading drawing", drawingId);
    
    if (!window.masterAssetLoader) {
        console.error("DRAWING_MANAGEMENT: masterAssetLoader not available");
        return;
    }
    
    return window.masterAssetLoader.loadDrawing(drawingId)
        .then(() => {
            console.log("DRAWING_MANAGEMENT: Drawing loaded successfully", drawingId);
            // ... existing code ...
        })
        .catch(error => {
            console.error("DRAWING_MANAGEMENT: Error loading drawing", drawingId, error);
            // ... existing code ...
        });
}
// ... existing code ... 