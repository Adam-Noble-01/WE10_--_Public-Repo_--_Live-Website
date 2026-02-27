// =============================================================================
// TRUEVISION3D - PAGE LAYOUT SYSTEM - PC MOUSE CONTROLS
// =============================================================================
//
// FILE       : Na__PageLayoutSystem__Controls__Pc__.js
// NAMESPACE  : Na__PageLayout
// MODULE     : PC Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Mouse drag/resize interaction for positioning the viewport image
// CREATED    : 11-Feb-2026
//
// DESCRIPTION:
// - Hit-test system determines if mouse is over image body or resize handle.
// - Left-click drag on image body: move the image on the A3 document.
// - Left-click drag on corner handle: proportional resize (maintain aspect).
// - Left-click drag on edge handle: clip/trim the image in that axis.
// - Cursor feedback changes based on hover state.
// - All coordinates transformed through canvasTransform for accurate interaction.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Canvas Render Pipeline Constants
    // ------------------------------------------------------------
    import { Na__PageLayout__HANDLE_SIZE_PX } from './Na__PageLayoutSystem__CanvasRenderPipeline__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Handle Hit-Test Radius
    // ------------------------------------------------------------
    const Na__PageLayout__HANDLE_HIT_RADIUS_PX = 10; // <-- Hit radius in CSS pixels for handle detection
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Handle Identifiers
    // ------------------------------------------------------------
    const HANDLE_NONE    = 'none';                                       // <-- No handle hit
    const HANDLE_TL      = 'tl';                                        // <-- Top-left corner
    const HANDLE_TR      = 'tr';                                        // <-- Top-right corner
    const HANDLE_BL      = 'bl';                                        // <-- Bottom-left corner
    const HANDLE_BR      = 'br';                                        // <-- Bottom-right corner
    const HANDLE_TC      = 'tc';                                        // <-- Top-center edge
    const HANDLE_BC      = 'bc';                                        // <-- Bottom-center edge
    const HANDLE_LC      = 'lc';                                        // <-- Left-center edge
    const HANDLE_RC      = 'rc';                                        // <-- Right-center edge
    const HANDLE_BODY    = 'body';                                       // <-- Image body (move)
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Handle to Cursor CSS Class Map
    // ------------------------------------------------------------
    const Na__PageLayout__HandleCursorMap = {
        [HANDLE_TL]   : 'na-layout-canvas--resize-nw',                  // <-- Top-left cursor
        [HANDLE_TR]   : 'na-layout-canvas--resize-ne',                  // <-- Top-right cursor
        [HANDLE_BL]   : 'na-layout-canvas--resize-sw',                  // <-- Bottom-left cursor
        [HANDLE_BR]   : 'na-layout-canvas--resize-se',                  // <-- Bottom-right cursor
        [HANDLE_TC]   : 'na-layout-canvas--resize-n',                   // <-- Top-center cursor
        [HANDLE_BC]   : 'na-layout-canvas--resize-s',                   // <-- Bottom-center cursor
        [HANDLE_LC]   : 'na-layout-canvas--resize-w',                   // <-- Left-center cursor
        [HANDLE_RC]   : 'na-layout-canvas--resize-e',                   // <-- Right-center cursor
        [HANDLE_BODY] : 'na-layout-canvas--grab',                       // <-- Move cursor
        [HANDLE_NONE] : ''                                               // <-- Default cursor
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Functions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert Screen Coordinates to Document mm
    // ------------------------------------------------------------
    function Na__PageLayout__ScreenToDocMm(screenX, screenY, canvasTransform) {
        const mmX = (screenX - canvasTransform.offsetX) / canvasTransform.zoom; // <-- Convert to mm
        const mmY = (screenY - canvasTransform.offsetY) / canvasTransform.zoom; // <-- Convert to mm
        return { x: mmX, y: mmY }; // <-- Return mm coordinates
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hit-Test Handles and Image Body
    // ------------------------------------------------------------
    function Na__PageLayout__HitTest(screenX, screenY, state) {
        const ct  = state.canvasTransform; // <-- Canvas transform shorthand
        const it  = state.imageTransform; // <-- Image transform shorthand
        const hit = Na__PageLayout__HANDLE_HIT_RADIUS_PX; // <-- Hit radius in CSS pixels

        // Convert image corners to screen coordinates
        // ------------------------------------------------------------
        const imgLeft   = ct.offsetX + (it.x * ct.zoom); // <-- Left edge screen X
        const imgTop    = ct.offsetY + (it.y * ct.zoom); // <-- Top edge screen Y
        const imgRight  = ct.offsetX + ((it.x + it.width) * ct.zoom); // <-- Right edge screen X
        const imgBottom = ct.offsetY + ((it.y + it.height) * ct.zoom); // <-- Bottom edge screen Y
        const imgMidX   = (imgLeft + imgRight) / 2; // <-- Horizontal midpoint
        const imgMidY   = (imgTop + imgBottom) / 2; // <-- Vertical midpoint

        // Check corner handles first (highest priority)
        // ------------------------------------------------------------
        if (Math.abs(screenX - imgLeft) < hit && Math.abs(screenY - imgTop) < hit)       return HANDLE_TL; // <-- Top-left
        if (Math.abs(screenX - imgRight) < hit && Math.abs(screenY - imgTop) < hit)      return HANDLE_TR; // <-- Top-right
        if (Math.abs(screenX - imgLeft) < hit && Math.abs(screenY - imgBottom) < hit)    return HANDLE_BL; // <-- Bottom-left
        if (Math.abs(screenX - imgRight) < hit && Math.abs(screenY - imgBottom) < hit)   return HANDLE_BR; // <-- Bottom-right

        // Check edge midpoint handles
        // ------------------------------------------------------------
        if (Math.abs(screenX - imgMidX) < hit && Math.abs(screenY - imgTop) < hit)      return HANDLE_TC; // <-- Top-center
        if (Math.abs(screenX - imgMidX) < hit && Math.abs(screenY - imgBottom) < hit)    return HANDLE_BC; // <-- Bottom-center
        if (Math.abs(screenX - imgLeft) < hit && Math.abs(screenY - imgMidY) < hit)      return HANDLE_LC; // <-- Left-center
        if (Math.abs(screenX - imgRight) < hit && Math.abs(screenY - imgMidY) < hit)     return HANDLE_RC; // <-- Right-center

        // Check image body (move region)
        // ------------------------------------------------------------
        if (screenX >= imgLeft && screenX <= imgRight && screenY >= imgTop && screenY <= imgBottom) {
            return HANDLE_BODY; // <-- Inside image body
        }

        return HANDLE_NONE; // <-- No hit
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Clear All Cursor Classes from Canvas
    // ------------------------------------------------------------
    function Na__PageLayout__ClearCursorClasses(canvas) {
        Object.values(Na__PageLayout__HandleCursorMap).forEach((cls) => {
            if (cls) canvas.classList.remove(cls); // <-- Remove each cursor class
        });
        canvas.classList.remove('na-layout-canvas--grabbing'); // <-- Also remove grabbing cursor
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | PC Controls Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize PC Mouse Controls
    // ------------------------------------------------------------
    function Na__PageLayout__InitPcControls(canvas, state, requestRedraw) {
        if (!canvas || !state) return; // <-- Guard against missing canvas or state

        let activeHandle = HANDLE_NONE; // <-- Currently active drag handle
        let isDragging   = false; // <-- Drag active flag
        let dragStartMm  = { x: 0, y: 0 }; // <-- Mouse position at drag start (mm)
        let dragStartTransform = { x: 0, y: 0, width: 0, height: 0 }; // <-- Image transform at drag start
        let imageAspect  = 1; // <-- Image aspect ratio (width / height)


        // SUB FUNCTION | Handle Mouse Down (Start Drag)
        // ------------------------------------------------------------
        const onMouseDown = (event) => {
            if (event.button !== 0) return; // <-- Only left-click

            const rect    = canvas.getBoundingClientRect(); // <-- Canvas bounding rect
            const screenX = event.clientX - rect.left; // <-- Mouse X in CSS pixels
            const screenY = event.clientY - rect.top; // <-- Mouse Y in CSS pixels

            const hitResult = Na__PageLayout__HitTest(screenX, screenY, state); // <-- Perform hit-test

            if (hitResult === HANDLE_NONE) {
                state.isImageSelected = false; // <-- Deselect image
                Na__PageLayout__ClearCursorClasses(canvas); // <-- Reset cursor
                requestRedraw(); // <-- Redraw to hide handles
                return;
            }

            // Start drag operation
            // ------------------------------------------------------------
            state.isImageSelected = true; // <-- Ensure image is selected
            isDragging   = true; // <-- Set drag active
            activeHandle = hitResult; // <-- Store active handle

            const mmPos  = Na__PageLayout__ScreenToDocMm(screenX, screenY, state.canvasTransform); // <-- Convert to mm
            dragStartMm  = { x: mmPos.x, y: mmPos.y }; // <-- Store start position

            dragStartTransform = { // <-- Store initial image transform
                x          : state.imageTransform.x,
                y          : state.imageTransform.y,
                width      : state.imageTransform.width,
                height     : state.imageTransform.height,
                clipTop    : state.imageTransform.clipTop || 0,
                clipRight  : state.imageTransform.clipRight || 0,
                clipBottom : state.imageTransform.clipBottom || 0,
                clipLeft   : state.imageTransform.clipLeft || 0
            };

            imageAspect = dragStartTransform.width / dragStartTransform.height; // <-- Calculate aspect ratio

            // Set appropriate cursor
            // ------------------------------------------------------------
            Na__PageLayout__ClearCursorClasses(canvas); // <-- Clear previous cursor
            if (hitResult === HANDLE_BODY) {
                canvas.classList.add('na-layout-canvas--grabbing'); // <-- Grabbing cursor for move
            } else {
                const cursorClass = Na__PageLayout__HandleCursorMap[hitResult]; // <-- Get cursor class
                if (cursorClass) canvas.classList.add(cursorClass); // <-- Apply cursor
            }

            event.preventDefault(); // <-- Prevent text selection
        };
        // ------------------------------------------------------------


        // SUB FUNCTION | Handle Mouse Move (Drag Update)
        // ------------------------------------------------------------
        const onMouseMove = (event) => {
            const rect    = canvas.getBoundingClientRect(); // <-- Canvas bounding rect
            const screenX = event.clientX - rect.left; // <-- Mouse X in CSS pixels
            const screenY = event.clientY - rect.top; // <-- Mouse Y in CSS pixels

            if (!isDragging) {
                // Hover cursor feedback (no drag active)
                // ------------------------------------------------------------
                if (!state.isImageSelected) return; // <-- No cursor feedback when deselected

                const hoverResult = Na__PageLayout__HitTest(screenX, screenY, state); // <-- Hit-test for cursor
                Na__PageLayout__ClearCursorClasses(canvas); // <-- Clear previous cursor
                const cursorClass = Na__PageLayout__HandleCursorMap[hoverResult]; // <-- Get cursor class
                if (cursorClass) canvas.classList.add(cursorClass); // <-- Apply cursor
                return;
            }

            // Active drag - update image transform
            // ------------------------------------------------------------
            const mmPos = Na__PageLayout__ScreenToDocMm(screenX, screenY, state.canvasTransform); // <-- Convert to mm
            const dx    = mmPos.x - dragStartMm.x; // <-- Delta X in mm
            const dy    = mmPos.y - dragStartMm.y; // <-- Delta Y in mm
            const it    = state.imageTransform; // <-- Shorthand for image transform

            if (activeHandle === HANDLE_BODY) {
                // Move image
                // ------------------------------------------------------------
                it.x = dragStartTransform.x + dx; // <-- Update X position
                it.y = dragStartTransform.y + dy; // <-- Update Y position
            }
            else if (activeHandle === HANDLE_BR) {
                // Bottom-right corner: proportional resize from top-left anchor
                // ------------------------------------------------------------
                const newWidth = Math.max(10, dragStartTransform.width + dx); // <-- Minimum 10mm width
                it.width  = newWidth; // <-- Update width
                it.height = newWidth / imageAspect; // <-- Maintain aspect ratio
            }
            else if (activeHandle === HANDLE_TL) {
                // Top-left corner: proportional resize from bottom-right anchor
                // ------------------------------------------------------------
                const newWidth = Math.max(10, dragStartTransform.width - dx); // <-- Calculate new width
                it.width  = newWidth; // <-- Update width
                it.height = newWidth / imageAspect; // <-- Maintain aspect ratio
                it.x      = dragStartTransform.x + dragStartTransform.width - newWidth; // <-- Anchor bottom-right
                it.y      = dragStartTransform.y + dragStartTransform.height - (newWidth / imageAspect); // <-- Anchor bottom-right
            }
            else if (activeHandle === HANDLE_TR) {
                // Top-right corner: proportional resize from bottom-left anchor
                // ------------------------------------------------------------
                const newWidth = Math.max(10, dragStartTransform.width + dx); // <-- Calculate new width
                it.width  = newWidth; // <-- Update width
                it.height = newWidth / imageAspect; // <-- Maintain aspect ratio
                it.y      = dragStartTransform.y + dragStartTransform.height - (newWidth / imageAspect); // <-- Anchor bottom-left
            }
            else if (activeHandle === HANDLE_BL) {
                // Bottom-left corner: proportional resize from top-right anchor
                // ------------------------------------------------------------
                const newWidth = Math.max(10, dragStartTransform.width - dx); // <-- Calculate new width
                it.width  = newWidth; // <-- Update width
                it.height = newWidth / imageAspect; // <-- Maintain aspect ratio
                it.x      = dragStartTransform.x + dragStartTransform.width - newWidth; // <-- Anchor top-right
            }
            else if (activeHandle === HANDLE_RC) {
                // Right-center edge: clip image from right
                // ------------------------------------------------------------
                const minVisible = 10; // <-- Minimum visible width in mm
                const maxClip    = dragStartTransform.width - minVisible - (dragStartTransform.clipLeft || 0); // <-- Maximum right clip
                it.clipRight     = Math.max(0, Math.min(maxClip, dragStartTransform.clipRight - dx)); // <-- Update right clip
            }
            else if (activeHandle === HANDLE_LC) {
                // Left-center edge: clip image from left
                // ------------------------------------------------------------
                const minVisible = 10; // <-- Minimum visible width in mm
                const maxClip    = dragStartTransform.width - minVisible - (dragStartTransform.clipRight || 0); // <-- Maximum left clip
                it.clipLeft      = Math.max(0, Math.min(maxClip, dragStartTransform.clipLeft + dx)); // <-- Update left clip
            }
            else if (activeHandle === HANDLE_BC) {
                // Bottom-center edge: clip image from bottom
                // ------------------------------------------------------------
                const minVisible = 10; // <-- Minimum visible height in mm
                const maxClip    = dragStartTransform.height - minVisible - (dragStartTransform.clipTop || 0); // <-- Maximum bottom clip
                it.clipBottom    = Math.max(0, Math.min(maxClip, dragStartTransform.clipBottom - dy)); // <-- Update bottom clip
            }
            else if (activeHandle === HANDLE_TC) {
                // Top-center edge: clip image from top
                // ------------------------------------------------------------
                const minVisible = 10; // <-- Minimum visible height in mm
                const maxClip    = dragStartTransform.height - minVisible - (dragStartTransform.clipBottom || 0); // <-- Maximum top clip
                it.clipTop       = Math.max(0, Math.min(maxClip, dragStartTransform.clipTop + dy)); // <-- Update top clip
            }

            requestRedraw(); // <-- Trigger canvas redraw
        };
        // ------------------------------------------------------------


        // SUB FUNCTION | Handle Mouse Up (End Drag)
        // ------------------------------------------------------------
        const onMouseUp = (event) => {
            if (event.button !== 0) return; // <-- Only left-click

            if (isDragging) {
                isDragging   = false; // <-- Clear drag flag
                activeHandle = HANDLE_NONE; // <-- Clear active handle

                // Reset cursor to hover state
                // ------------------------------------------------------------
                Na__PageLayout__ClearCursorClasses(canvas); // <-- Clear drag cursor
                if (state.isImageSelected) {
                    const rect    = canvas.getBoundingClientRect(); // <-- Canvas bounding rect
                    const screenX = event.clientX - rect.left; // <-- Mouse position
                    const screenY = event.clientY - rect.top; // <-- Mouse position
                    const hoverResult = Na__PageLayout__HitTest(screenX, screenY, state); // <-- Hit-test
                    const cursorClass = Na__PageLayout__HandleCursorMap[hoverResult]; // <-- Get cursor
                    if (cursorClass) canvas.classList.add(cursorClass); // <-- Apply hover cursor
                }
            }
        };
        // ------------------------------------------------------------


        // Bind event listeners
        // ------------------------------------------------------------
        canvas.addEventListener('mousedown', onMouseDown); // <-- Drag start
        window.addEventListener('mousemove', onMouseMove); // <-- Drag update (window for out-of-bounds)
        window.addEventListener('mouseup', onMouseUp); // <-- Drag end (window for out-of-bounds)
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | PC Controls API
    // ------------------------------------------------------------
    export {
        Na__PageLayout__InitPcControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

