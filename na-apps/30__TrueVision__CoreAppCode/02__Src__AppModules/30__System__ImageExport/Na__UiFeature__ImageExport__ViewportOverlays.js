// -----------------------------------------------------------------------------
// REGION | UI Feature - Image Export Viewport Overlays
// -----------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // REGION | Overlay Helper Utilities
    // -------------------------------------------------------------------------

    // HELPER FUNCTION | Parse Aspect Ratio String
    // ------------------------------------------------------------
    function Na__UiFeature__ParseAspectRatio(ratioString) {
        const parts = ratioString.split(':').map(Number); // <-- Split and convert to numbers
        if (parts.length !== 2 || parts.some(Number.isNaN)) { // <-- Validate format
            return { width: 3, height: 2 }; // <-- Default to 3:2 if invalid
        }
        return { width: parts[0], height: parts[1] }; // <-- Return parsed ratio
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Debounce Function
    // ------------------------------------------------------------
    function Na__UiFeature__Debounce(func, wait) {
        let timeout; // <-- Store timeout ID
        return function executedFunction(...args) { // <-- Return debounced function
            const later = () => { // <-- Delayed execution function
                clearTimeout(timeout); // <-- Clear existing timeout
                func(...args); // <-- Execute function with arguments
            };
            clearTimeout(timeout); // <-- Clear previous timeout
            timeout = setTimeout(later, wait); // <-- Set new timeout
        };
    }
    // ------------------------------------------------------------

    // endregion --------------------------------------------------------------


    // -------------------------------------------------------------------------
    // REGION | Overlay DOM Elements and State
    // -------------------------------------------------------------------------

    // MODULE VARIABLES | Overlay Element References
    // ------------------------------------------------------------
    let overlayContainer = null; // <-- Overlay container element
    let safeFrameTop = null; // <-- Top safe frame bar
    let safeFrameBottom = null; // <-- Bottom safe frame bar
    let safeFrameLeft = null; // <-- Left safe frame bar
    let safeFrameRight = null; // <-- Right safe frame bar
    let thirdsLineH1 = null; // <-- First horizontal thirds line
    let thirdsLineH2 = null; // <-- Second horizontal thirds line
    let thirdsLineV1 = null; // <-- First vertical thirds line
    let thirdsLineV2 = null; // <-- Second vertical thirds line
    let currentAspectRatio = null; // <-- Current aspect ratio string
    let isVisible = false; // <-- Overlay visibility state
    // ------------------------------------------------------------


    // HELPER FUNCTION | Get Viewport Dimensions
    // ------------------------------------------------------------
    function Na__UiFeature__GetViewportDimensions() {
        const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--Vale_HeaderHeight')) || 60; // <-- Get header height from CSS variable
        const viewportWidth = window.innerWidth; // <-- Full viewport width
        const viewportHeight = window.innerHeight - headerHeight; // <-- Viewport height minus header
        return { width: viewportWidth, height: viewportHeight, headerHeight }; // <-- Return dimensions
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Calculate Safe Frame Dimensions
    // ------------------------------------------------------------
    function Na__UiFeature__CalculateSafeFrame(viewportWidth, viewportHeight, aspectRatio) {
        const ratio = aspectRatio.width / aspectRatio.height; // <-- Calculate aspect ratio value
        const viewportRatio = viewportWidth / viewportHeight; // <-- Calculate viewport aspect ratio
        
        let frameWidth, frameHeight; // <-- Safe frame dimensions
        
        if (viewportRatio > ratio) { // <-- Viewport is wider than target ratio (pillarbox)
            frameHeight = viewportHeight; // <-- Use full height
            frameWidth = frameHeight * ratio; // <-- Calculate width from height
        } else { // <-- Viewport is taller than target ratio (letterbox)
            frameWidth = viewportWidth; // <-- Use full width
            frameHeight = frameWidth / ratio; // <-- Calculate height from width
        }
        
        const frameLeft = (viewportWidth - frameWidth) / 2; // <-- Center horizontally
        const frameTop = (viewportHeight - frameHeight) / 2; // <-- Center vertically
        
        return { // <-- Return calculated frame dimensions
            frameWidth,
            frameHeight,
            frameLeft,
            frameTop,
            frameRight: frameLeft + frameWidth, // <-- Right edge position
            frameBottom: frameTop + frameHeight // <-- Bottom edge position
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Overlay Positions
    // ------------------------------------------------------------
    function Na__UiFeature__UpdateOverlayPositions() {
        if (!overlayContainer || !isVisible || !currentAspectRatio) return; // <-- Exit if overlay not ready
        
        const viewport = Na__UiFeature__GetViewportDimensions(); // <-- Get current viewport dimensions
        const aspectRatio = Na__UiFeature__ParseAspectRatio(currentAspectRatio); // <-- Parse aspect ratio string
        const frame = Na__UiFeature__CalculateSafeFrame(viewport.width, viewport.height, aspectRatio); // <-- Calculate safe frame
        
        // Update safe frame bars
        // ------------------------------------------------------------
        if (safeFrameTop) { // <-- Top bar exists
            safeFrameTop.style.height = `${frame.frameTop}px`; // <-- Set top bar height
        }
        if (safeFrameBottom) { // <-- Bottom bar exists
            safeFrameBottom.style.height = `${viewport.height - frame.frameBottom}px`; // <-- Set bottom bar height
        }
        if (safeFrameLeft) { // <-- Left bar exists
            safeFrameLeft.style.width = `${frame.frameLeft}px`; // <-- Set left bar width
            safeFrameLeft.style.top = `${frame.frameTop}px`; // <-- Position from top of safe frame
            safeFrameLeft.style.height = `${frame.frameHeight}px`; // <-- Set height to match safe frame
        }
        if (safeFrameRight) { // <-- Right bar exists
            safeFrameRight.style.width = `${viewport.width - frame.frameRight}px`; // <-- Set right bar width
            safeFrameRight.style.top = `${frame.frameTop}px`; // <-- Position from top of safe frame
            safeFrameRight.style.height = `${frame.frameHeight}px`; // <-- Set height to match safe frame
        }
        
        // Update rule of thirds grid lines
        // ------------------------------------------------------------
        const thirdsWidth = frame.frameWidth / 3; // <-- One third of frame width
        const thirdsHeight = frame.frameHeight / 3; // <-- One third of frame height
        
        if (thirdsLineH1) { // <-- First horizontal line exists
            thirdsLineH1.style.left = `${frame.frameLeft}px`; // <-- Position from left edge
            thirdsLineH1.style.top = `${frame.frameTop + thirdsHeight}px`; // <-- Position at first third
            thirdsLineH1.style.width = `${frame.frameWidth}px`; // <-- Full frame width
        }
        if (thirdsLineH2) { // <-- Second horizontal line exists
            thirdsLineH2.style.left = `${frame.frameLeft}px`; // <-- Position from left edge
            thirdsLineH2.style.top = `${frame.frameTop + (thirdsHeight * 2)}px`; // <-- Position at second third
            thirdsLineH2.style.width = `${frame.frameWidth}px`; // <-- Full frame width
        }
        if (thirdsLineV1) { // <-- First vertical line exists
            thirdsLineV1.style.left = `${frame.frameLeft + thirdsWidth}px`; // <-- Position at first third
            thirdsLineV1.style.top = `${frame.frameTop}px`; // <-- Position from top edge
            thirdsLineV1.style.height = `${frame.frameHeight}px`; // <-- Full frame height
        }
        if (thirdsLineV2) { // <-- Second vertical line exists
            thirdsLineV2.style.left = `${frame.frameLeft + (thirdsWidth * 2)}px`; // <-- Position at second third
            thirdsLineV2.style.top = `${frame.frameTop}px`; // <-- Position from top edge
            thirdsLineV2.style.height = `${frame.frameHeight}px`; // <-- Full frame height
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Show Overlay
    // ------------------------------------------------------------
    function Na__UiFeature__ShowOverlay() {
        if (!overlayContainer) return; // <-- Exit if container doesn't exist
        isVisible = true; // <-- Set visibility state
        overlayContainer.classList.add('na-export-overlay--visible'); // <-- Add visible class
        Na__UiFeature__UpdateOverlayPositions(); // <-- Update positions immediately
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide Overlay
    // ------------------------------------------------------------
    function Na__UiFeature__HideOverlay() {
        if (!overlayContainer) return; // <-- Exit if container doesn't exist
        isVisible = false; // <-- Set visibility state
        overlayContainer.classList.remove('na-export-overlay--visible'); // <-- Remove visible class
    }
    // ------------------------------------------------------------


    // FUNCTION | Create Viewport Overlays
    // ------------------------------------------------------------
    function Na__UiFeature__CreateViewportOverlays() {
        // Get overlay elements from DOM (already created in HTML)
        // ------------------------------------------------------------
        overlayContainer = document.getElementById('naExportOverlay'); // <-- Get overlay container
        if (!overlayContainer) return; // <-- Exit if container doesn't exist
        
        // Get safe frame bar elements
        // ------------------------------------------------------------
        safeFrameTop = document.getElementById('naExportSafeTop'); // <-- Get top bar
        safeFrameBottom = document.getElementById('naExportSafeBottom'); // <-- Get bottom bar
        safeFrameLeft = document.getElementById('naExportSafeLeft'); // <-- Get left bar
        safeFrameRight = document.getElementById('naExportSafeRight'); // <-- Get right bar
        
        // Get rule of thirds grid line elements
        // ------------------------------------------------------------
        thirdsLineH1 = document.getElementById('naExportThirdsH1'); // <-- Get first horizontal line
        thirdsLineH2 = document.getElementById('naExportThirdsH2'); // <-- Get second horizontal line
        thirdsLineV1 = document.getElementById('naExportThirdsV1'); // <-- Get first vertical line
        thirdsLineV2 = document.getElementById('naExportThirdsV2'); // <-- Get second vertical line
        
        // Setup resize listener
        // ------------------------------------------------------------
        const debouncedUpdate = Na__UiFeature__Debounce(Na__UiFeature__UpdateOverlayPositions, 150); // <-- Create debounced update function
        window.addEventListener('resize', debouncedUpdate); // <-- Listen for window resize events
    }
    // ------------------------------------------------------------


    // FUNCTION | Update Viewport Overlays
    // ------------------------------------------------------------
    function Na__UiFeature__UpdateViewportOverlays(aspectRatioString, visible) {
        if (!overlayContainer) { // <-- Check if overlay exists
            Na__UiFeature__CreateViewportOverlays(); // <-- Initialize if not already done
        }
        if (!overlayContainer) return; // <-- Exit if still doesn't exist after initialization
        
        currentAspectRatio = aspectRatioString; // <-- Store current aspect ratio
        
        if (visible) { // <-- Show overlay if requested
            Na__UiFeature__ShowOverlay(); // <-- Show overlay
        } else { // <-- Hide overlay if not requested
            Na__UiFeature__HideOverlay(); // <-- Hide overlay
        }
    }
    // ------------------------------------------------------------

    // endregion --------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Viewport Overlay API
    // ------------------------------------------------------------
    export {
        Na__UiFeature__CreateViewportOverlays,
        Na__UiFeature__UpdateViewportOverlays
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
