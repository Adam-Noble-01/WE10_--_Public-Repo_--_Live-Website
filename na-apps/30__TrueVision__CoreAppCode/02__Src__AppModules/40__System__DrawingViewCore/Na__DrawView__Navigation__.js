// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - 2D NAVIGATION
// =============================================================================
//
// FILE       : Na__DrawView__Navigation__.js
// NAMESPACE  : Na__DrawNav
// MODULE     : Drawing View Core - 2D Navigation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Pan and zoom only navigation while any 2D drawing is displayed
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - A 2D drawing locks rotation completely. You are looking at a 3D model, but
//   through a parallel projection locked to a fixed plane, so the only moves
//   that make sense are sliding across the drawing and zooming into it. Any
//   orbit would break the drawing and is simply never wired up here.
// - Dragging moves the drawing WITH the cursor, which means the camera travels
//   the opposite way across its own plane. Because the projection is parallel,
//   one screen pixel is a constant number of scene units, so the drawing
//   tracks the pointer exactly rather than drifting at the edges.
// - Wheel and pinch zoom keep the point under the cursor fixed, which is what
//   makes zooming into a corner of a drawing feel controlled.
// - THE CAMERA'S THIRD COORDINATE IS NEVER TOUCHED. Panning moves within the
//   drawing plane only, so navigation can never drift the camera off the plane
//   and silently change what the drawing shows - a plan cannot slide off its
//   cut height, and an elevation cannot slide forward through the building.
// - Markup dragging takes priority: the annotations layer raises the
//   suppression flag while it owns the pointer, so text never pans the sheet.
//
// - This module knows nothing about which drawing it is steering. Every camera
//   move goes through Na__DrawView__ActiveView__, and the pan and zoom FEEL is
//   handed in on Attach, so a floor plan and an elevation can be tuned
//   separately from their own config files.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ and Na__Elevation__ModeController__ call
//   Attach on entering their drawing and Detach on leaving it.
// - Na__PlanAnnotations__Editor__ calls SetSuppressed around its own drags.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Sep-2026 - Version 1.0.0
// - Moved here from Na__FloorPlan__PlanNavigation__.js (31-Aug-2026 v1.0.0) and
//   generalised. The pointer, pinch and zoom-at-cursor behaviour is unchanged;
//   what moved is where the camera calls land - the active view broker rather
//   than the floor plan camera - and where the feel values come from.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import {
        Na__RenderLoop__RequestRender,
        Na__RenderLoop__RequestActiveRender,
        Na__RenderLoop__StopActiveRender
    } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Active Drawing View Broker
    // ------------------------------------------------------------
    // @delegate: ./Na__DrawView__ActiveView__.js
    // ------------------------------------------------------------
    import {
        Na__DrawView__GetCamera,
        Na__DrawView__GetUnitsPerPixel,
        Na__DrawView__PanByPlaneUnits,
        Na__DrawView__ZoomByFactor
    } from './Na__DrawView__ActiveView__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Render Loop Reason Tag
    // ------------------------------------------------------------
    const Na__DrawNav__RENDER_REASON = 'drawingview-pan';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Navigation Feel Defaults
    // ------------------------------------------------------------
    // Used when a caller attaches without supplying a setup block, so a
    // half-wired drawing still pans and zooms rather than sitting inert.
    // ------------------------------------------------------------
    const Na__DrawNav__DEFAULT_SETUP = Object.freeze({
        zoomStepFactor   : 1.12,
        invertWheel      : false,
        panButton        : 0,
        enableTouchPan   : true,
        enableTouchPinch : true
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Attachment and Interaction State
    // ------------------------------------------------------------
    let Na__DrawNav__Canvas     = null;    // <-- Element the listeners are bound to
    let Na__DrawNav__Attached   = false;   // <-- Guard against double-attach
    let Na__DrawNav__Suppressed = false;   // <-- Markup layer owns the pointer
    let Na__DrawNav__Setup      = Na__DrawNav__DEFAULT_SETUP;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Active Drag Tracking
    // ------------------------------------------------------------
    let Na__DrawNav__Dragging   = false;
    let Na__DrawNav__LastX      = 0;
    let Na__DrawNav__LastY      = 0;
    let Na__DrawNav__PointerId  = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Pinch Zoom Tracking
    // ------------------------------------------------------------
    const Na__DrawNav__ActivePointers = new Map();   // <-- pointerId -> { x, y }
    let Na__DrawNav__LastPinchDist    = 0;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Viewport Size of the Bound Canvas
    // ------------------------------------------------------------
    function Na__DrawNav__GetViewportSize() {
        if (!Na__DrawNav__Canvas) return { width: window.innerWidth, height: window.innerHeight };
        return {
            width  : Na__DrawNav__Canvas.clientWidth  || window.innerWidth,
            height : Na__DrawNav__Canvas.clientHeight || window.innerHeight
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Viewport Coordinates to Canvas-Local Ones
    // ------------------------------------------------------------
    // The render canvas is NOT flush with the viewport - it starts below the
    // app header - so a pointer's clientY is not its position on the drawing.
    // Zoom-at-cursor needs the corrected value or it drifts vertically.
    // ------------------------------------------------------------
    function Na__DrawNav__ClientToLocal(clientX, clientY) {
        if (!Na__DrawNav__Canvas) return { x: clientX, y: clientY };
        const rect = Na__DrawNav__Canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert a Screen Drag Into a Camera Move
    // ------------------------------------------------------------
    // The camera travels opposite to the drag so the drawing follows the
    // cursor. Both deltas are handed on in SCREEN sense - right and down
    // positive - and the active drawing's adapter decides what that means in
    // the world.
    // ------------------------------------------------------------
    function Na__DrawNav__PanByScreenDelta(deltaScreenX, deltaScreenY) {
        const size = Na__DrawNav__GetViewportSize();
        const upp  = Na__DrawView__GetUnitsPerPixel(size.height);
        if (!upp) return;

        Na__DrawView__PanByPlaneUnits(-deltaScreenX * upp, -deltaScreenY * upp);
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Zoom While Keeping the Cursor Point Fixed
    // ------------------------------------------------------------
    // Takes VIEWPORT coordinates straight off the event. Under a parallel
    // projection the point under the cursor shifts by a predictable amount
    // when zoom changes, so it is corrected with a single pan rather than an
    // unproject before and after.
    // ------------------------------------------------------------
    function Na__DrawNav__ZoomAtCursor(factor, clientX, clientY) {
        if (!Na__DrawView__GetCamera()) return;

        const size      = Na__DrawNav__GetViewportSize();
        const uppBefore = Na__DrawView__GetUnitsPerPixel(size.height);

        Na__DrawView__ZoomByFactor(factor);

        const uppAfter = Na__DrawView__GetUnitsPerPixel(size.height);
        const uppDelta = uppBefore - uppAfter;
        if (!uppDelta) {
            Na__RenderLoop__RequestRender();
            return;                                                              // <-- Clamped at min/max zoom: nothing moved
        }

        // Offset of the cursor from the canvas centre, in pixels.
        const local   = Na__DrawNav__ClientToLocal(clientX, clientY);
        const offsetX = local.x - (size.width  / 2);
        const offsetY = local.y - (size.height / 2);

        Na__DrawView__PanByPlaneUnits(offsetX * uppDelta, offsetY * uppDelta);
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Distance Between the Two Active Touch Points
    // ------------------------------------------------------------
    function Na__DrawNav__GetPinchDistance() {
        const points = Array.from(Na__DrawNav__ActivePointers.values());
        if (points.length < 2) return 0;
        const dx = points[0].x - points[1].x;
        const dy = points[0].y - points[1].y;
        return Math.sqrt((dx * dx) + (dy * dy));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Midpoint Between the Two Active Touch Points
    // ------------------------------------------------------------
    function Na__DrawNav__GetPinchCentre() {
        const points = Array.from(Na__DrawNav__ActivePointers.values());
        if (points.length < 2) return { x: 0, y: 0 };
        return {
            x : (points[0].x + points[1].x) / 2,
            y : (points[0].y + points[1].y) / 2
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pointer Handlers
// -----------------------------------------------------------------------------

    // SUB FUNCTION | Pointer Down - Begin a Pan or a Pinch
    // ------------------------------------------------------------
    function Na__DrawNav__HandlePointerDown(event) {
        if (Na__DrawNav__Suppressed) return;                                     // <-- Markup layer owns this pointer

        const setup = Na__DrawNav__Setup;
        Na__DrawNav__ActivePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (Na__DrawNav__ActivePointers.size === 2 && setup.enableTouchPinch) {
            Na__DrawNav__Dragging      = false;                                  // <-- Second finger cancels the pan
            Na__DrawNav__LastPinchDist = Na__DrawNav__GetPinchDistance();
            return;
        }
        if (Na__DrawNav__ActivePointers.size !== 1) return;

        const isTouch = event.pointerType !== 'mouse';
        if (isTouch && !setup.enableTouchPan) return;
        if (!isTouch && event.button !== setup.panButton) return;

        Na__DrawNav__Dragging  = true;
        Na__DrawNav__PointerId = event.pointerId;
        Na__DrawNav__LastX     = event.clientX;
        Na__DrawNav__LastY     = event.clientY;

        if (Na__DrawNav__Canvas && Na__DrawNav__Canvas.setPointerCapture) {
            Na__DrawNav__Canvas.setPointerCapture(event.pointerId);              // <-- Keep the drag alive off-canvas
        }
        Na__RenderLoop__RequestActiveRender(Na__DrawNav__RENDER_REASON);
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Pointer Move - Live Pan or Pinch Zoom
    // ------------------------------------------------------------
    function Na__DrawNav__HandlePointerMove(event) {
        if (!Na__DrawNav__ActivePointers.has(event.pointerId)) return;
        Na__DrawNav__ActivePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        // PINCH ZOOM | Two fingers down
        if (Na__DrawNav__ActivePointers.size === 2) {
            const distance = Na__DrawNav__GetPinchDistance();
            if (Na__DrawNav__LastPinchDist > 0 && distance > 0) {
                const centre = Na__DrawNav__GetPinchCentre();
                Na__DrawNav__ZoomAtCursor(distance / Na__DrawNav__LastPinchDist, centre.x, centre.y);
            }
            Na__DrawNav__LastPinchDist = distance;
            return;
        }

        // PAN | Single pointer drag
        if (!Na__DrawNav__Dragging || event.pointerId !== Na__DrawNav__PointerId) return;

        Na__DrawNav__PanByScreenDelta(event.clientX - Na__DrawNav__LastX, event.clientY - Na__DrawNav__LastY);
        Na__DrawNav__LastX = event.clientX;
        Na__DrawNav__LastY = event.clientY;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Pointer Up - End the Pan or Pinch
    // ------------------------------------------------------------
    function Na__DrawNav__HandlePointerUp(event) {
        Na__DrawNav__ActivePointers.delete(event.pointerId);

        if (Na__DrawNav__ActivePointers.size < 2) Na__DrawNav__LastPinchDist = 0;

        if (event.pointerId !== Na__DrawNav__PointerId) return;

        Na__DrawNav__Dragging  = false;
        Na__DrawNav__PointerId = null;

        if (Na__DrawNav__Canvas && Na__DrawNav__Canvas.releasePointerCapture) {
            try {
                Na__DrawNav__Canvas.releasePointerCapture(event.pointerId);
            } catch (error) {
                // Capture may already have been lost; nothing to release.
            }
        }
        Na__RenderLoop__StopActiveRender(Na__DrawNav__RENDER_REASON);
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Wheel - Zoom Toward the Cursor
    // ------------------------------------------------------------
    function Na__DrawNav__HandleWheel(event) {
        if (Na__DrawNav__Suppressed) return;
        event.preventDefault();                                                  // <-- Never let the page scroll behind the drawing

        const setup     = Na__DrawNav__Setup;
        const zoomingIn = setup.invertWheel ? (event.deltaY > 0) : (event.deltaY < 0);
        const factor    = zoomingIn ? setup.zoomStepFactor : (1 / setup.zoomStepFactor);

        Na__DrawNav__ZoomAtCursor(factor, event.clientX, event.clientY);
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Swallow the Context Menu While Panning
    // ------------------------------------------------------------
    function Na__DrawNav__HandleContextMenu(event) {
        if (Na__DrawNav__Dragging) event.preventDefault();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Attachment
// -----------------------------------------------------------------------------

    // FUNCTION | Bind 2D Navigation to the Canvas
    // ------------------------------------------------------------
    // setup is the calling drawing's own navigation feel block; anything
    // omitted falls back to the shared default so a partial block still works.
    // ------------------------------------------------------------
    function Na__DrawNav__Attach(canvas, setup) {
        if (Na__DrawNav__Attached || !canvas) return false;

        Na__DrawNav__Setup  = Object.assign({}, Na__DrawNav__DEFAULT_SETUP, setup || {});
        Na__DrawNav__Canvas = canvas;

        canvas.addEventListener('pointerdown',   Na__DrawNav__HandlePointerDown);
        canvas.addEventListener('pointermove',   Na__DrawNav__HandlePointerMove);
        canvas.addEventListener('pointerup',     Na__DrawNav__HandlePointerUp);
        canvas.addEventListener('pointercancel', Na__DrawNav__HandlePointerUp);
        canvas.addEventListener('wheel',         Na__DrawNav__HandleWheel, { passive: false });
        canvas.addEventListener('contextmenu',   Na__DrawNav__HandleContextMenu);

        Na__DrawNav__Attached = true;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Unbind 2D Navigation and Clear All Drag State
    // ------------------------------------------------------------
    function Na__DrawNav__Detach() {
        if (!Na__DrawNav__Attached || !Na__DrawNav__Canvas) return false;

        const canvas = Na__DrawNav__Canvas;
        canvas.removeEventListener('pointerdown',   Na__DrawNav__HandlePointerDown);
        canvas.removeEventListener('pointermove',   Na__DrawNav__HandlePointerMove);
        canvas.removeEventListener('pointerup',     Na__DrawNav__HandlePointerUp);
        canvas.removeEventListener('pointercancel', Na__DrawNav__HandlePointerUp);
        canvas.removeEventListener('wheel',         Na__DrawNav__HandleWheel);
        canvas.removeEventListener('contextmenu',   Na__DrawNav__HandleContextMenu);

        Na__DrawNav__ActivePointers.clear();
        Na__DrawNav__Dragging      = false;
        Na__DrawNav__PointerId     = null;
        Na__DrawNav__LastPinchDist = 0;
        Na__DrawNav__Suppressed    = false;
        Na__DrawNav__Attached      = false;
        Na__DrawNav__Canvas        = null;
        Na__DrawNav__Setup         = Na__DrawNav__DEFAULT_SETUP;

        Na__RenderLoop__StopActiveRender(Na__DrawNav__RENDER_REASON);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Suppress Panning While Another Layer Owns the Pointer
    // ------------------------------------------------------------
    // Raised by the annotations editor while text is being dragged or edited,
    // so moving a room label never drags the drawing underneath it.
    // ------------------------------------------------------------
    function Na__DrawNav__SetSuppressed(suppressed) {
        Na__DrawNav__Suppressed = (suppressed === true);
        if (Na__DrawNav__Suppressed) {
            Na__DrawNav__Dragging  = false;
            Na__DrawNav__PointerId = null;
            Na__DrawNav__ActivePointers.clear();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Is 2D Navigation Currently Bound?
    // ------------------------------------------------------------
    function Na__DrawNav__IsAttached() {
        return Na__DrawNav__Attached;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | 2D Drawing Navigation API
    // ------------------------------------------------------------
    export {
        Na__DrawNav__Attach,
        Na__DrawNav__Detach,
        Na__DrawNav__SetSuppressed,
        Na__DrawNav__IsAttached
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
