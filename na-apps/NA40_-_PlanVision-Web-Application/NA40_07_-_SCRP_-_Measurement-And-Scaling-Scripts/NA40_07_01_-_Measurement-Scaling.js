function initializeMeasurementScaling() {
    console.log("MEASUREMENT_SCALING: Initializing measurement scaling");
    
    if (window.masterAssetLoader && window.masterAssetLoader.isImageLoaded && window.masterAssetLoader.isImageLoaded()) {
        console.log("MEASUREMENT_SCALING: Image is loaded, proceeding with initialization");
        setupMeasurementScaling();
    } else {
        console.warn("MEASUREMENT_SCALING: Image not loaded yet");
        // Wait for image to be loaded
        document.addEventListener('assetsLoaded', onImageLoaded);
    }
}

function onImageLoaded(event) {
    console.log("MEASUREMENT_SCALING: Image loaded event received");
    if (window.masterAssetLoader && window.masterAssetLoader.isImageLoaded && window.masterAssetLoader.isImageLoaded()) {
        console.log("MEASUREMENT_SCALING: Image is loaded, proceeding with initialization");
        setupMeasurementScaling();
    } else {
        console.warn("MEASUREMENT_SCALING: Image not loaded yet");
    }
}

function setupMeasurementScaling() {
    console.log("MEASUREMENT_SCALING: Setting up measurement scaling");
    
    if (!window.masterAssetLoader || !window.masterAssetLoader.isImageLoaded()) {
        console.warn("MEASUREMENT_SCALING: Cannot setup measurement scaling - image not loaded");
        return;
    }
    
    // Get image dimensions from masterAssetLoader
    const imageDimensions = window.masterAssetLoader.getImageDimensions();
    if (!imageDimensions) {
        console.warn("MEASUREMENT_SCALING: Cannot setup measurement scaling - no image dimensions");
        return;
    }
    
    // ... existing code ...
}

// ... existing code ...
function calculateScale() {
    if (!window.masterAssetLoader || !window.masterAssetLoader.isImageLoaded()) {
        console.warn("MEASUREMENT_SCALING: Cannot calculate scale - image not loaded");
        return null;
    }
    
    const imageDimensions = window.masterAssetLoader.getImageDimensions();
    if (!imageDimensions) {
        console.warn("MEASUREMENT_SCALING: Cannot calculate scale - no image dimensions");
        return null;
    }
    
    // ... existing code ...
}
// ... existing code ... 