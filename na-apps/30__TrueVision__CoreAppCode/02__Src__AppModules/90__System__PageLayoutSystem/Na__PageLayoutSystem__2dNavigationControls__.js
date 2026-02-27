// =============================================================================
// TRUEVISION3D - PAGE LAYOUT SYSTEM - 2D NAVIGATION CONTROLS
// =============================================================================
//
// FILE       : Na__PageLayoutSystem__2dNavigationControls__.js
// NAMESPACE  : Na__PageLayout
// MODULE     : 2D Navigation Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Pan and zoom controls for the 2D layout canvas view
// CREATED    : 11-Feb-2026
//
// DESCRIPTION:
// - Mouse wheel zoom: zooms toward cursor position, clamped min/max range.
// - Middle-click drag: pans the canvas view.
// - Right-click drag: alternative pan for trackpad users.
// - Two-finger pinch: zoom (touch devices), handled in touch controls module.
// - Updates canvasTransform on shared state and requests redraw.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Zoom Limits and Step
    // ------------------------------------------------------------
    const Na__PageLayout__ZOOM_MIN      = 0.1;                           // <-- Minimum zoom (pixels per mm)
    const Na__PageLayout__ZOOM_MAX      = 5.0;                           // <-- Maximum zoom (pixels per mm)
    const Na__PageLayout__ZOOM_FACTOR   = 1.08;                          // <-- Zoom multiplier per wheel tick
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Navigation Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize 2D Navigation Controls
    // ------------------------------------------------------------
    function Na__PageLayout__InitNavigation(canvas, state, requestRedraw) {
        if (!canvas || !state) return; // <-- Guard against missing canvas or state

        let isPanning    = false; // <-- Pan drag active flag
        let panStartX    = 0; // <-- Pan drag start X (screen pixels)
        let panStartY    = 0; // <-- Pan drag start Y (screen pixels)
        let panOriginX   = 0; // <-- Canvas offsetX at pan start
        let panOriginY   = 0; // <-- Canvas offsetY at pan start


        // SUB FUNCTION | Handle Mouse Wheel Zoom
        // ------------------------------------------------------------
        const onWheel = (event) => {
            event.preventDefault(); // <-- Prevent page scroll

            const rect    = canvas.getBoundingClientRect(); // <-- Canvas bounding rect
            const mouseX  = event.clientX - rect.left; // <-- Mouse X in CSS pixels relative to canvas
            const mouseY  = event.clientY - rect.top; // <-- Mouse Y in CSS pixels relative to canvas

            const ct      = state.canvasTransform; // <-- Shorthand for canvas transform
            const oldZoom = ct.zoom; // <-- Current zoom level

            // Calculate new zoom level
            // ------------------------------------------------------------
            let newZoom; // <-- Target zoom level
            if (event.deltaY < 0) { // <-- Scroll up = zoom in
                newZoom = oldZoom * Na__PageLayout__ZOOM_FACTOR; // <-- Increase zoom
            } else { // <-- Scroll down = zoom out
                newZoom = oldZoom / Na__PageLayout__ZOOM_FACTOR; // <-- Decrease zoom
            }
            newZoom = Math.max(Na__PageLayout__ZOOM_MIN, Math.min(Na__PageLayout__ZOOM_MAX, newZoom)); // <-- Clamp zoom

            // Zoom toward cursor position
            // ------------------------------------------------------------
            const zoomRatio = newZoom / oldZoom; // <-- Ratio of new to old zoom
            ct.offsetX = mouseX - (mouseX - ct.offsetX) * zoomRatio; // <-- Adjust offset to zoom toward cursor
            ct.offsetY = mouseY - (mouseY - ct.offsetY) * zoomRatio; // <-- Adjust offset to zoom toward cursor
            ct.zoom    = newZoom; // <-- Apply new zoom

            requestRedraw(); // <-- Trigger canvas redraw
        };
        // ------------------------------------------------------------


        // SUB FUNCTION | Handle Mouse Down (Start Pan)
        // ------------------------------------------------------------
        const onMouseDown = (event) => {
            // Middle-click (button 1) or right-click (button 2) starts pan
            // ------------------------------------------------------------
            if (event.button === 1 || event.button === 2) {
                event.preventDefault(); // <-- Prevent default behavior
                isPanning  = true; // <-- Set pan active
                panStartX  = event.clientX; // <-- Store start position
                panStartY  = event.clientY; // <-- Store start position
                panOriginX = state.canvasTransform.offsetX; // <-- Store initial offset
                panOriginY = state.canvasTransform.offsetY; // <-- Store initial offset
                canvas.classList.add('na-layout-canvas--pan'); // <-- Set pan cursor
            }
        };
        // ------------------------------------------------------------


        // SUB FUNCTION | Handle Mouse Move (Pan Drag)
        // ------------------------------------------------------------
        const onMouseMove = (event) => {
            if (!isPanning) return; // <-- Only process during pan

            const dx = event.clientX - panStartX; // <-- Delta X from pan start
            const dy = event.clientY - panStartY; // <-- Delta Y from pan start

            state.canvasTransform.offsetX = panOriginX + dx; // <-- Update offset
            state.canvasTransform.offsetY = panOriginY + dy; // <-- Update offset

            requestRedraw(); // <-- Trigger canvas redraw
        };
        // ------------------------------------------------------------


        // SUB FUNCTION | Handle Mouse Up (End Pan)
        // ------------------------------------------------------------
        const onMouseUp = (event) => {
            if (isPanning && (event.button === 1 || event.button === 2)) {
                isPanning = false; // <-- Clear pan active
                canvas.classList.remove('na-layout-canvas--pan'); // <-- Reset cursor
            }
        };
        // ------------------------------------------------------------


        // SUB FUNCTION | Suppress Context Menu on Right-Click
        // ------------------------------------------------------------
        const onContextMenu = (event) => {
            event.preventDefault(); // <-- Prevent browser context menu
        };
        // ------------------------------------------------------------


        // Bind event listeners
        // ------------------------------------------------------------
        canvas.addEventListener('wheel', onWheel, { passive: false }); // <-- Wheel zoom
        canvas.addEventListener('mousedown', onMouseDown); // <-- Pan start
        window.addEventListener('mousemove', onMouseMove); // <-- Pan drag (window for out-of-bounds)
        window.addEventListener('mouseup', onMouseUp); // <-- Pan end (window for out-of-bounds)
        canvas.addEventListener('contextmenu', onContextMenu); // <-- Suppress context menu
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | 2D Navigation API
    // ------------------------------------------------------------
    export {
        Na__PageLayout__InitNavigation
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

