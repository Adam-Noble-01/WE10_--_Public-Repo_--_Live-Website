// =============================================================================
// TRUEVISION3D - PAGE LAYOUT SYSTEM - MAIN SYSTEM LOGIC
// =============================================================================
//
// FILE       : Na__PageLayoutSystem__SystemLogic__Main__.js
// NAMESPACE  : Na__PageLayout
// MODULE     : SystemLogic Main
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Main orchestrator for the Page Layout System
// CREATED    : 11-Feb-2026
//
// DESCRIPTION:
// - Entry point for the Page Layout System (standalone new-tab page).
// - Reads rendered viewport image from window.opener global property.
// - Loads the A3 title block PNG as a locked background layer.
// - Manages shared state object consumed by all sub-modules.
// - Handles canvas sizing with DPR-aware resolution for sharp rendering.
// - Provides the requestRedraw() hook for sub-modules to trigger re-renders.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | A3 Document Dimensions (Landscape)
    // ------------------------------------------------------------
    const Na__PageLayout__A3_WIDTH_MM   = 420;                           // <-- A3 landscape width in millimeters
    const Na__PageLayout__A3_HEIGHT_MM  = 297;                           // <-- A3 landscape height in millimeters
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Title Block Asset Path
    // ------------------------------------------------------------
    const Na__PageLayout__TITLE_BLOCK_PATH = 'PageLayoutSystem__TitleBlock__A3__.png'; // <-- Title block PNG relative to layout HTML
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Image Data Transfer Key
    // ------------------------------------------------------------
    const Na__PageLayout__OPENER_KEY = '__Na__PageLayout__PendingImage'; // <-- Property name on window.opener
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Load Image from URL as Promise
    // ------------------------------------------------------------
    function Na__PageLayout__LoadImage(src) {
        return new Promise((resolve, reject) => {
            const img    = new Image(); // <-- Create new image element
            img.onload   = () => resolve(img); // <-- Resolve on successful load
            img.onerror  = (err) => reject(err); // <-- Reject on error
            img.src      = src; // <-- Set source to trigger load
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Calculate Fit-To-Page Zoom and Offset
    // ------------------------------------------------------------
    function Na__PageLayout__CalculateFitToPage(canvasWidth, canvasHeight, dpr) {
        const logicalWidth   = canvasWidth / dpr; // <-- CSS pixel width
        const logicalHeight  = canvasHeight / dpr; // <-- CSS pixel height
        const padding        = 40; // <-- Padding in CSS pixels around the A3 page

        const availableWidth  = logicalWidth - (padding * 2); // <-- Available width after padding
        const availableHeight = logicalHeight - (padding * 2); // <-- Available height after padding

        const scaleX = availableWidth / Na__PageLayout__A3_WIDTH_MM; // <-- Scale to fit width
        const scaleY = availableHeight / Na__PageLayout__A3_HEIGHT_MM; // <-- Scale to fit height
        const zoom   = Math.min(scaleX, scaleY); // <-- Use smallest scale to fit both dimensions

        const offsetX = (logicalWidth - (Na__PageLayout__A3_WIDTH_MM * zoom)) / 2; // <-- Center horizontally
        const offsetY = (logicalHeight - (Na__PageLayout__A3_HEIGHT_MM * zoom)) / 2; // <-- Center vertically

        return { zoom, offsetX, offsetY }; // <-- Return fit parameters
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Calculate Initial Image Transform
    // ------------------------------------------------------------
    function Na__PageLayout__CalculateInitialImageTransform(imageWidth, imageHeight) {
        const imageAspect    = imageWidth / imageHeight; // <-- Source image aspect ratio
        const maxWidthMm     = Na__PageLayout__A3_WIDTH_MM * 0.80; // <-- 80% of A3 width
        const maxHeightMm    = Na__PageLayout__A3_HEIGHT_MM * 0.80; // <-- 80% of A3 height

        let fitWidthMm, fitHeightMm; // <-- Final image dimensions in mm

        if (imageAspect > (maxWidthMm / maxHeightMm)) { // <-- Image is wider than available space
            fitWidthMm  = maxWidthMm; // <-- Constrain by width
            fitHeightMm = maxWidthMm / imageAspect; // <-- Calculate height from width
        } else { // <-- Image is taller than available space
            fitHeightMm = maxHeightMm; // <-- Constrain by height
            fitWidthMm  = maxHeightMm * imageAspect; // <-- Calculate width from height
        }

        const x = (Na__PageLayout__A3_WIDTH_MM - fitWidthMm) / 2; // <-- Center horizontally on A3
        const y = (Na__PageLayout__A3_HEIGHT_MM - fitHeightMm) / 2; // <-- Center vertically on A3

        return {
            x      : x,             // <-- X position in mm from A3 left edge
            y      : y,             // <-- Y position in mm from A3 top edge
            width  : fitWidthMm,    // <-- Width in mm on A3 document
            height : fitHeightMm    // <-- Height in mm on A3 document
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Setup DPR-Aware Canvas Sizing
    // ------------------------------------------------------------
    function Na__PageLayout__SetupCanvasSize(canvas, container) {
        const dpr    = window.devicePixelRatio || 1; // <-- Device pixel ratio
        const width  = container.clientWidth; // <-- Container CSS width
        const height = container.clientHeight; // <-- Container CSS height

        canvas.width           = width * dpr; // <-- Set internal resolution
        canvas.height          = height * dpr; // <-- Set internal resolution
        canvas.style.width     = width + 'px'; // <-- Set display size
        canvas.style.height    = height + 'px'; // <-- Set display size

        return { width: canvas.width, height: canvas.height, dpr }; // <-- Return actual dimensions
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | System Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Page Layout System
    // ------------------------------------------------------------
    async function Na__PageLayout__Initialize(canvas, canvasContainer, errorOverlay) {

        // Read image data from opener window
        // ------------------------------------------------------------
        let imageData = null; // <-- Will hold { dataUrl, width, height, aspectRatio }

        if (window.opener && window.opener[Na__PageLayout__OPENER_KEY]) {
            imageData = window.opener[Na__PageLayout__OPENER_KEY]; // <-- Read from opener
            window.opener[Na__PageLayout__OPENER_KEY] = null; // <-- Clear to free memory on opener
        }

        if (!imageData || !imageData.dataUrl) {
            // Show error overlay if no image data available
            // ------------------------------------------------------------
            if (errorOverlay) {
                errorOverlay.style.display = 'flex'; // <-- Show error overlay
            }
            console.warn('[PageLayout] No image data found on window.opener'); // <-- Log warning
            return null; // <-- Abort initialization
        }

        // Load viewport image from data URL
        // ------------------------------------------------------------
        let viewportImage = null; // <-- Will hold loaded Image element
        try {
            viewportImage = await Na__PageLayout__LoadImage(imageData.dataUrl); // <-- Load image from dataUrl
        } catch (err) {
            console.error('[PageLayout] Failed to load viewport image:', err); // <-- Log error
            if (errorOverlay) {
                errorOverlay.style.display = 'flex'; // <-- Show error overlay
            }
            return null; // <-- Abort initialization
        }

        // Load title block PNG
        // ------------------------------------------------------------
        let titleBlockImage = null; // <-- Will hold loaded Image element
        try {
            titleBlockImage = await Na__PageLayout__LoadImage(Na__PageLayout__TITLE_BLOCK_PATH); // <-- Load title block
        } catch (err) {
            console.error('[PageLayout] Failed to load title block:', err); // <-- Log error
            // Continue without title block (degrade gracefully)
        }

        // Setup canvas dimensions
        // ------------------------------------------------------------
        const canvasSize = Na__PageLayout__SetupCanvasSize(canvas, canvasContainer); // <-- Size canvas to container

        // Calculate initial canvas transform (fit A3 page to viewport)
        // ------------------------------------------------------------
        const fitParams = Na__PageLayout__CalculateFitToPage(canvasSize.width, canvasSize.height, canvasSize.dpr); // <-- Fit to page

        // Calculate initial image placement (centered, 80% of A3)
        // ------------------------------------------------------------
        const initialTransform = Na__PageLayout__CalculateInitialImageTransform(imageData.width, imageData.height); // <-- Center image

        // Build shared state object
        // ------------------------------------------------------------
        const state = {
            // A3 Document Constants
            a3 : {
                widthMm  : Na__PageLayout__A3_WIDTH_MM,              // <-- 420mm
                heightMm : Na__PageLayout__A3_HEIGHT_MM              // <-- 297mm
            },

            // Title Block Image (locked background layer)
            titleBlockImage : titleBlockImage,                        // <-- Image element or null

            // Viewport Image (user-positionable foreground layer)
            viewportImage   : viewportImage,                          // <-- Image element

            // Image Transform (position and size in mm on A3 document)
            imageTransform : {
                x      : initialTransform.x,                          // <-- X position in mm
                y      : initialTransform.y,                          // <-- Y position in mm
                width  : initialTransform.width,                      // <-- Width in mm
                height : initialTransform.height,                     // <-- Height in mm
                clipTop    : 0,                                       // <-- Clipping from top edge in mm
                clipRight  : 0,                                       // <-- Clipping from right edge in mm
                clipBottom : 0,                                       // <-- Clipping from bottom edge in mm
                clipLeft   : 0                                        // <-- Clipping from left edge in mm
            },

            // Canvas Transform (2D pan/zoom of the entire canvas view)
            canvasTransform : {
                offsetX : fitParams.offsetX,                          // <-- Pan offset X in CSS pixels
                offsetY : fitParams.offsetY,                          // <-- Pan offset Y in CSS pixels
                zoom    : fitParams.zoom                              // <-- Zoom level (pixels per mm)
            },

            // Canvas Metadata
            dpr             : canvasSize.dpr,                         // <-- Device pixel ratio
            isImageSelected : true,                                   // <-- Image starts selected (handles visible)

            // Source Image Metadata
            sourceImageMeta : {
                width       : imageData.width,                        // <-- Original image width in pixels
                height      : imageData.height,                       // <-- Original image height in pixels
                aspectRatio : imageData.aspectRatio                   // <-- Original aspect ratio string or null
            },

            // Redraw hook (set by boot script after initialization)
            requestRedraw : null                                      // <-- Will be set to the render function
        };

        // Handle window resize
        // ------------------------------------------------------------
        let resizeTimeout = null; // <-- Debounce timer
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout); // <-- Clear previous timer
            resizeTimeout = setTimeout(() => {
                const newSize    = Na__PageLayout__SetupCanvasSize(canvas, canvasContainer); // <-- Recalculate canvas size
                state.dpr        = newSize.dpr; // <-- Update DPR

                const newFit     = Na__PageLayout__CalculateFitToPage(newSize.width, newSize.height, newSize.dpr); // <-- Recalculate fit
                state.canvasTransform.offsetX = newFit.offsetX; // <-- Update offset
                state.canvasTransform.offsetY = newFit.offsetY; // <-- Update offset
                state.canvasTransform.zoom    = newFit.zoom; // <-- Update zoom

                if (state.requestRedraw) {
                    state.requestRedraw(); // <-- Trigger redraw
                }
            }, 150); // <-- 150ms debounce
        });

        // Handle close button
        // ------------------------------------------------------------
        const closeButton = document.getElementById('naLayoutClose'); // <-- Close button
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                window.close(); // <-- Close the tab
            });
        }

        // Notify opener tab that layout page loaded successfully
        // ------------------------------------------------------------
        if (window.opener) {
            window.opener.postMessage({ type: 'Na__PageLayout__Ready' }, '*'); // <-- Signal parent tab
        }

        return state; // <-- Return initialized state
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | System Logic API
    // ------------------------------------------------------------
    export {
        Na__PageLayout__Initialize,
        Na__PageLayout__A3_WIDTH_MM,
        Na__PageLayout__A3_HEIGHT_MM
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

