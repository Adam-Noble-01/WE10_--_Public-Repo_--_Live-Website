// =============================================================================
// TRUEVISION3D - PAGE LAYOUT SYSTEM - TOUCH SCREEN CONTROLS
// =============================================================================
//
// FILE       : Na__PageLayoutSystem__Controls__TouchScreen__.js
// NAMESPACE  : Na__PageLayout
// MODULE     : Touch Screen Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Touch interaction for positioning and zooming on touch devices
// CREATED    : 11-Feb-2026
//
// DESCRIPTION:
// - Single-finger drag on image body: move the image on the A3 document.
// - Single-finger drag on corner handle: proportional resize.
// - Single-finger drag on edge handle: clip/trim image from that edge.
// - Two-finger pinch: zoom the canvas view.
// - Two-finger drag: pan the canvas view.
// - Distinguishes image interaction (single touch on image) from navigation
//   gestures (two-finger touch).
// - Uses preventDefault to suppress browser scroll/zoom during interaction.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Touch Hit-Test Settings
    // ------------------------------------------------------------
    const Na__PageLayout__TOUCH_HIT_RADIUS_PX = 20; // <-- Larger hit radius for fingers (CSS pixels)
    const Na__PageLayout__MIN_IMAGE_SIZE_MM   = 10; // <-- Minimum image dimension in mm
    const Na__PageLayout__MIN_VISIBLE_MM      = 10; // <-- Minimum visible content when clipping
    const Na__PageLayout__ZOOM_MIN            = 0.1; // <-- Minimum zoom level
    const Na__PageLayout__ZOOM_MAX            = 5.0; // <-- Maximum zoom level
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


    // HELPER FUNCTION | Calculate Distance Between Two Touch Points
    // ------------------------------------------------------------
    function Na__PageLayout__TouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX; // <-- Horizontal distance
        const dy = touch1.clientY - touch2.clientY; // <-- Vertical distance
        return Math.sqrt(dx * dx + dy * dy); // <-- Euclidean distance
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Calculate Midpoint Between Two Touch Points
    // ------------------------------------------------------------
    function Na__PageLayout__TouchMidpoint(touch1, touch2, rect) {
        return {
            x: ((touch1.clientX + touch2.clientX) / 2) - rect.left, // <-- Midpoint X relative to canvas
            y: ((touch1.clientY + touch2.clientY) / 2) - rect.top   // <-- Midpoint Y relative to canvas
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hit-Test for Touch (Larger Radius)
    // ------------------------------------------------------------
    function Na__PageLayout__TouchHitTest(screenX, screenY, state) {
        const ct  = state.canvasTransform; // <-- Canvas transform shorthand
        const it  = state.imageTransform; // <-- Image transform shorthand
        const hit = Na__PageLayout__TOUCH_HIT_RADIUS_PX; // <-- Hit radius

        // Convert image bounds to screen coordinates
        // ------------------------------------------------------------
        const imgLeft   = ct.offsetX + (it.x * ct.zoom); // <-- Left edge screen X
        const imgTop    = ct.offsetY + (it.y * ct.zoom); // <-- Top edge screen Y
        const imgRight  = ct.offsetX + ((it.x + it.width) * ct.zoom); // <-- Right edge screen X
        const imgBottom = ct.offsetY + ((it.y + it.height) * ct.zoom); // <-- Bottom edge screen Y
        const imgMidX   = (imgLeft + imgRight) / 2; // <-- Horizontal midpoint
        const imgMidY   = (imgTop + imgBottom) / 2; // <-- Vertical midpoint

        // Check corners (proportional resize)
        // ------------------------------------------------------------
        if (Math.abs(screenX - imgLeft) < hit && Math.abs(screenY - imgTop) < hit)       return 'tl';
        if (Math.abs(screenX - imgRight) < hit && Math.abs(screenY - imgTop) < hit)      return 'tr';
        if (Math.abs(screenX - imgLeft) < hit && Math.abs(screenY - imgBottom) < hit)    return 'bl';
        if (Math.abs(screenX - imgRight) < hit && Math.abs(screenY - imgBottom) < hit)   return 'br';

        // Check edge midpoint handles (clip/trim)
        // ------------------------------------------------------------
        if (Math.abs(screenX - imgMidX) < hit && Math.abs(screenY - imgTop) < hit)       return 'tc';
        if (Math.abs(screenX - imgMidX) < hit && Math.abs(screenY - imgBottom) < hit)    return 'bc';
        if (Math.abs(screenX - imgLeft) < hit && Math.abs(screenY - imgMidY) < hit)      return 'lc';
        if (Math.abs(screenX - imgRight) < hit && Math.abs(screenY - imgMidY) < hit)     return 'rc';

        // Check image body (move)
        // ------------------------------------------------------------
        if (screenX >= imgLeft && screenX <= imgRight && screenY >= imgTop && screenY <= imgBottom) {
            return 'body';
        }

        return 'none'; // <-- No hit
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Touch Controls Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Touch Screen Controls
    // ------------------------------------------------------------
    function Na__PageLayout__InitTouchControls(canvas, state, requestRedraw) {
        if (!canvas || !state) return; // <-- Guard against missing canvas or state

        let touchMode       = 'none'; // <-- Current touch mode: 'none', 'image-move', 'image-resize', 'nav-pinch'
        let activeHandle    = 'none'; // <-- Active handle during resize
        let dragStartMm     = { x: 0, y: 0 }; // <-- Touch start position in mm
        let dragStartTransform = { x: 0, y: 0, width: 0, height: 0, clipTop: 0, clipRight: 0, clipBottom: 0, clipLeft: 0 }; // <-- Image transform at start
        let imageAspect     = 1; // <-- Image aspect ratio

        // Two-finger navigation state
        // ------------------------------------------------------------
        let pinchStartDistance = 0; // <-- Distance between fingers at pinch start
        let pinchStartZoom    = 0; // <-- Zoom level at pinch start
        let pinchStartMidX    = 0; // <-- Midpoint X at pinch start
        let pinchStartMidY    = 0; // <-- Midpoint Y at pinch start
        let pinchStartOffsetX = 0; // <-- Canvas offsetX at pinch start
        let pinchStartOffsetY = 0; // <-- Canvas offsetY at pinch start


        // SUB FUNCTION | Handle Touch Start
        // ------------------------------------------------------------
        const onTouchStart = (event) => {
            const touches = event.touches; // <-- All active touches

            if (touches.length === 2) {
                // Two-finger gesture: pinch/pan navigation
                // ------------------------------------------------------------
                event.preventDefault(); // <-- Suppress browser zoom
                touchMode = 'nav-pinch'; // <-- Set navigation mode

                const rect = canvas.getBoundingClientRect(); // <-- Canvas rect
                pinchStartDistance = Na__PageLayout__TouchDistance(touches[0], touches[1]); // <-- Initial distance
                pinchStartZoom    = state.canvasTransform.zoom; // <-- Initial zoom

                const mid         = Na__PageLayout__TouchMidpoint(touches[0], touches[1], rect); // <-- Initial midpoint
                pinchStartMidX    = mid.x; // <-- Store midpoint
                pinchStartMidY    = mid.y; // <-- Store midpoint
                pinchStartOffsetX = state.canvasTransform.offsetX; // <-- Store offset
                pinchStartOffsetY = state.canvasTransform.offsetY; // <-- Store offset
                return;
            }

            if (touches.length === 1) {
                // Single-finger: check if touching image
                // ------------------------------------------------------------
                const rect    = canvas.getBoundingClientRect(); // <-- Canvas rect
                const screenX = touches[0].clientX - rect.left; // <-- Touch X in CSS pixels
                const screenY = touches[0].clientY - rect.top; // <-- Touch Y in CSS pixels

                const hitResult = Na__PageLayout__TouchHitTest(screenX, screenY, state); // <-- Hit-test

                if (hitResult === 'body') {
                    event.preventDefault(); // <-- Suppress scroll
                    touchMode = 'image-move'; // <-- Set move mode
                    state.isImageSelected = true; // <-- Select image

                    const mmPos   = Na__PageLayout__ScreenToDocMm(screenX, screenY, state.canvasTransform); // <-- Convert to mm
                    dragStartMm   = { x: mmPos.x, y: mmPos.y }; // <-- Store start position
                    dragStartTransform = { // <-- Store initial transform
                        ...state.imageTransform,
                        clipTop    : state.imageTransform.clipTop || 0,
                        clipRight  : state.imageTransform.clipRight || 0,
                        clipBottom : state.imageTransform.clipBottom || 0,
                        clipLeft   : state.imageTransform.clipLeft || 0
                    };
                    requestRedraw(); // <-- Show handles
                }
                else if (hitResult !== 'none') {
                    event.preventDefault(); // <-- Suppress scroll
                    touchMode    = 'image-resize'; // <-- Set resize mode
                    activeHandle = hitResult; // <-- Store active handle
                    state.isImageSelected = true; // <-- Select image

                    const mmPos   = Na__PageLayout__ScreenToDocMm(screenX, screenY, state.canvasTransform); // <-- Convert to mm
                    dragStartMm   = { x: mmPos.x, y: mmPos.y }; // <-- Store start position
                    dragStartTransform = { // <-- Store initial transform
                        ...state.imageTransform,
                        clipTop    : state.imageTransform.clipTop || 0,
                        clipRight  : state.imageTransform.clipRight || 0,
                        clipBottom : state.imageTransform.clipBottom || 0,
                        clipLeft   : state.imageTransform.clipLeft || 0
                    };
                    imageAspect   = dragStartTransform.width / dragStartTransform.height; // <-- Aspect ratio
                    requestRedraw(); // <-- Show handles
                }
                else {
                    // Touch on empty space: deselect
                    // ------------------------------------------------------------
                    state.isImageSelected = false; // <-- Deselect image
                    touchMode = 'none'; // <-- No active mode
                    requestRedraw(); // <-- Hide handles
                }
            }
        };
        // ------------------------------------------------------------


        // SUB FUNCTION | Handle Touch Move
        // ------------------------------------------------------------
        const onTouchMove = (event) => {
            const touches = event.touches; // <-- All active touches

            if (touchMode === 'nav-pinch' && touches.length === 2) {
                // Two-finger pinch/pan update
                // ------------------------------------------------------------
                event.preventDefault(); // <-- Suppress browser zoom

                const rect = canvas.getBoundingClientRect(); // <-- Canvas rect
                const currentDistance = Na__PageLayout__TouchDistance(touches[0], touches[1]); // <-- Current distance
                const currentMid     = Na__PageLayout__TouchMidpoint(touches[0], touches[1], rect); // <-- Current midpoint

                // Calculate new zoom from pinch ratio
                // ------------------------------------------------------------
                const pinchRatio = currentDistance / pinchStartDistance; // <-- Pinch ratio
                let newZoom      = pinchStartZoom * pinchRatio; // <-- Scale zoom by ratio
                newZoom          = Math.max(Na__PageLayout__ZOOM_MIN, Math.min(Na__PageLayout__ZOOM_MAX, newZoom)); // <-- Clamp

                // Calculate pan delta from midpoint movement
                // ------------------------------------------------------------
                const panDx = currentMid.x - pinchStartMidX; // <-- Pan delta X
                const panDy = currentMid.y - pinchStartMidY; // <-- Pan delta Y

                // Apply zoom toward pinch midpoint + pan
                // ------------------------------------------------------------
                const zoomRatio = newZoom / pinchStartZoom; // <-- Zoom change ratio
                state.canvasTransform.offsetX = pinchStartMidX - (pinchStartMidX - pinchStartOffsetX) * zoomRatio + panDx; // <-- Update offset
                state.canvasTransform.offsetY = pinchStartMidY - (pinchStartMidY - pinchStartOffsetY) * zoomRatio + panDy; // <-- Update offset
                state.canvasTransform.zoom    = newZoom; // <-- Apply zoom

                requestRedraw(); // <-- Trigger redraw
                return;
            }

            if (touches.length !== 1) return; // <-- Only single-touch for image interaction
            if (touchMode === 'none') return; // <-- No active mode

            event.preventDefault(); // <-- Suppress scroll

            const rect    = canvas.getBoundingClientRect(); // <-- Canvas rect
            const screenX = touches[0].clientX - rect.left; // <-- Touch X
            const screenY = touches[0].clientY - rect.top; // <-- Touch Y
            const mmPos   = Na__PageLayout__ScreenToDocMm(screenX, screenY, state.canvasTransform); // <-- Convert to mm
            const dx      = mmPos.x - dragStartMm.x; // <-- Delta X in mm
            const dy      = mmPos.y - dragStartMm.y; // <-- Delta Y in mm
            const it      = state.imageTransform; // <-- Image transform shorthand

            if (touchMode === 'image-move') {
                // Move image
                // ------------------------------------------------------------
                it.x = dragStartTransform.x + dx; // <-- Update X
                it.y = dragStartTransform.y + dy; // <-- Update Y
            }
            else if (touchMode === 'image-resize') {
                // Resize or clip image via active handle
                // ------------------------------------------------------------
                if (activeHandle === 'br') {
                    const newWidth = Math.max(Na__PageLayout__MIN_IMAGE_SIZE_MM, dragStartTransform.width + dx);
                    it.width  = newWidth;
                    it.height = newWidth / imageAspect;
                }
                else if (activeHandle === 'tl') {
                    const newWidth = Math.max(Na__PageLayout__MIN_IMAGE_SIZE_MM, dragStartTransform.width - dx);
                    it.width  = newWidth;
                    it.height = newWidth / imageAspect;
                    it.x      = dragStartTransform.x + dragStartTransform.width - newWidth;
                    it.y      = dragStartTransform.y + dragStartTransform.height - (newWidth / imageAspect);
                }
                else if (activeHandle === 'tr') {
                    const newWidth = Math.max(Na__PageLayout__MIN_IMAGE_SIZE_MM, dragStartTransform.width + dx);
                    it.width  = newWidth;
                    it.height = newWidth / imageAspect;
                    it.y      = dragStartTransform.y + dragStartTransform.height - (newWidth / imageAspect);
                }
                else if (activeHandle === 'bl') {
                    const newWidth = Math.max(Na__PageLayout__MIN_IMAGE_SIZE_MM, dragStartTransform.width - dx);
                    it.width  = newWidth;
                    it.height = newWidth / imageAspect;
                    it.x      = dragStartTransform.x + dragStartTransform.width - newWidth;
                }
                else if (activeHandle === 'rc') {
                    const maxClip = dragStartTransform.width - Na__PageLayout__MIN_VISIBLE_MM - (dragStartTransform.clipLeft || 0); // <-- Maximum right clip
                    it.clipRight  = Math.max(0, Math.min(maxClip, dragStartTransform.clipRight - dx)); // <-- Update right clip
                }
                else if (activeHandle === 'lc') {
                    const maxClip = dragStartTransform.width - Na__PageLayout__MIN_VISIBLE_MM - (dragStartTransform.clipRight || 0); // <-- Maximum left clip
                    it.clipLeft   = Math.max(0, Math.min(maxClip, dragStartTransform.clipLeft + dx)); // <-- Update left clip
                }
                else if (activeHandle === 'bc') {
                    const maxClip = dragStartTransform.height - Na__PageLayout__MIN_VISIBLE_MM - (dragStartTransform.clipTop || 0); // <-- Maximum bottom clip
                    it.clipBottom = Math.max(0, Math.min(maxClip, dragStartTransform.clipBottom - dy)); // <-- Update bottom clip
                }
                else if (activeHandle === 'tc') {
                    const maxClip = dragStartTransform.height - Na__PageLayout__MIN_VISIBLE_MM - (dragStartTransform.clipBottom || 0); // <-- Maximum top clip
                    it.clipTop    = Math.max(0, Math.min(maxClip, dragStartTransform.clipTop + dy)); // <-- Update top clip
                }
            }

            requestRedraw(); // <-- Trigger redraw
        };
        // ------------------------------------------------------------


        // SUB FUNCTION | Handle Touch End
        // ------------------------------------------------------------
        const onTouchEnd = (event) => {
            if (event.touches.length === 0) {
                // All fingers lifted
                // ------------------------------------------------------------
                touchMode    = 'none'; // <-- Reset mode
                activeHandle = 'none'; // <-- Reset handle
            }
            else if (event.touches.length === 1 && touchMode === 'nav-pinch') {
                // Transitioned from two-finger to one-finger: cancel nav
                // ------------------------------------------------------------
                touchMode = 'none'; // <-- Stop navigation
            }
        };
        // ------------------------------------------------------------


        // Bind event listeners
        // ------------------------------------------------------------
        canvas.addEventListener('touchstart', onTouchStart, { passive: false }); // <-- Touch start
        canvas.addEventListener('touchmove', onTouchMove, { passive: false }); // <-- Touch move
        canvas.addEventListener('touchend', onTouchEnd); // <-- Touch end
        canvas.addEventListener('touchcancel', onTouchEnd); // <-- Touch cancel
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Touch Controls API
    // ------------------------------------------------------------
    export {
        Na__PageLayout__InitTouchControls
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

