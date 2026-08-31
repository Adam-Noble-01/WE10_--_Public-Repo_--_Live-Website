// =============================================================================
// TRUEVISION3D - FLOOR PLAN VIEWS - PLAN NAVIGATION
// =============================================================================
//
// FILE       : Na__FloorPlan__PlanNavigation__.js
// NAMESPACE  : Na__FpNav
// MODULE     : Floor Plan Views - Plan Navigation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Pan and zoom only navigation while a floor plan is displayed
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Plan mode locks rotation completely. You are looking at a 3D model, but
//   through a parallel projection locked to the horizontal plane, so the only
//   moves that make sense are sliding across the drawing and zooming into it.
//   Any orbit would break the drawing and is simply never wired up here.
// - Dragging moves the drawing WITH the cursor, which means the camera travels
//   the opposite way across world X/Z. Because the projection is parallel, one
//   screen pixel is a constant number of scene units, so the drawing tracks the
//   pointer exactly rather than drifting at the edges.
// - Wheel and pinch zoom keep the point under the cursor fixed, which is what
//   makes zooming into a corner of a plan feel controlled.
// - Camera height is never touched, so navigation can never drift the camera
//   off its cut plane and silently change what the plan shows.
// - Annotation dragging takes priority: the annotations layer raises the
//   suppression flag while it owns the pointer, so text never pans the plan.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ calls Attach on entering plan mode and
//   Detach on leaving it.
// - Na__PlanAnnotations__Editor__ calls SetSuppressed around its own drags.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder.
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

    // MODULE IMPORTS | Plan Camera and Config
    // ------------------------------------------------------------
    // @delegate: ./Na__FloorPlan__OrthoCamera__.js
    // @delegate: ./Na__FloorPlan__ConfigState__.js
    // ------------------------------------------------------------
    import {
        Na__FpCam__GetCamera,
        Na__FpCam__PanByUnits,
        Na__FpCam__ZoomByFactor,
        Na__FpCam__GetUnitsPerPixel
    } from './Na__FloorPlan__OrthoCamera__.js';
    import { Na__FpCfg__GetNavigationSetup } from './Na__FloorPlan__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Render Loop Reason Tag
    // ------------------------------------------------------------
    const Na__FpNav__RENDER_REASON = 'floorplan-pan';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Attachment and Interaction State
    // ------------------------------------------------------------
    let Na__FpNav__Canvas     = null;    // <-- Element the listeners are bound to
    let Na__FpNav__Attached   = false;   // <-- Guard against double-attach
    let Na__FpNav__Suppressed = false;   // <-- Annotations layer owns the pointer
    // ------------------------------------------------------------

    // MODULE VARIABLES | Active Drag Tracking
    // ------------------------------------------------------------
    let Na__FpNav__Dragging   = false;
    let Na__FpNav__LastX      = 0;
    let Na__FpNav__LastY      = 0;
    let Na__FpNav__PointerId  = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Pinch Zoom Tracking
    // ------------------------------------------------------------
    const Na__FpNav__ActivePointers = new Map();   // <-- pointerId -> { x, y }
    let Na__FpNav__LastPinchDist    = 0;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Viewport Size of the Bound Canvas
    // ------------------------------------------------------------
    function Na__FpNav__GetViewportSize() {
        if (!Na__FpNav__Canvas) return { width: window.innerWidth, height: window.innerHeight };
        return {
            width  : Na__FpNav__Canvas.clientWidth  || window.innerWidth,
            height : Na__FpNav__Canvas.clientHeight || window.innerHeight
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert Viewport Coordinates to Canvas-Local Ones
    // ------------------------------------------------------------
    // The render canvas is NOT flush with the viewport - it starts below the
    // app header - so a pointer's clientY is not its position on the drawing.
    // Zoom-at-cursor needs the corrected value or it drifts vertically.
    // ------------------------------------------------------------
    function Na__FpNav__ClientToLocal(clientX, clientY) {
        if (!Na__FpNav__Canvas) return { x: clientX, y: clientY };
        const rect = Na__FpNav__Canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert a Screen Drag Into a Camera Move
    // ------------------------------------------------------------
    // The camera travels opposite to the drag so the drawing follows the
    // cursor. Screen X maps to world +X and screen Y maps to world +Z, which
    // is fixed by the plan camera's -Z up vector.
    // ------------------------------------------------------------
    function Na__FpNav__PanByScreenDelta(deltaScreenX, deltaScreenY) {
        const size = Na__FpNav__GetViewportSize();
        const upp  = Na__FpCam__GetUnitsPerPixel(size.height);
        if (!upp) return;

        Na__FpCam__PanByUnits(-deltaScreenX * upp, -deltaScreenY * upp);
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Zoom While Keeping the Cursor Point Fixed
    // ------------------------------------------------------------
    // Takes VIEWPORT coordinates straight off the event. Under a parallel
    // projection the world point under the cursor shifts by a predictable
    // amount when zoom changes, so it is corrected with a single pan rather
    // than an unproject before and after.
    // ------------------------------------------------------------
    function Na__FpNav__ZoomAtCursor(factor, clientX, clientY) {
        const camera = Na__FpCam__GetCamera();
        if (!camera) return;

        const size = Na__FpNav__GetViewportSize();
        const uppBefore = Na__FpCam__GetUnitsPerPixel(size.height);

        Na__FpCam__ZoomByFactor(factor);

        const uppAfter = Na__FpCam__GetUnitsPerPixel(size.height);
        const uppDelta = uppBefore - uppAfter;
        if (!uppDelta) {
            Na__RenderLoop__RequestRender();
            return;                                                              // <-- Clamped at min/max zoom: nothing moved
        }

        // Offset of the cursor from the canvas centre, in pixels.
        const local   = Na__FpNav__ClientToLocal(clientX, clientY);
        const offsetX = local.x - (size.width  / 2);
        const offsetY = local.y - (size.height / 2);

        Na__FpCam__PanByUnits(offsetX * uppDelta, offsetY * uppDelta);
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Distance Between the Two Active Touch Points
    // ------------------------------------------------------------
    function Na__FpNav__GetPinchDistance() {
        const points = Array.from(Na__FpNav__ActivePointers.values());
        if (points.length < 2) return 0;
        const dx = points[0].x - points[1].x;
        const dy = points[0].y - points[1].y;
        return Math.sqrt((dx * dx) + (dy * dy));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Midpoint Between the Two Active Touch Points
    // ------------------------------------------------------------
    function Na__FpNav__GetPinchCentre() {
        const points = Array.from(Na__FpNav__ActivePointers.values());
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
    function Na__FpNav__HandlePointerDown(event) {
        if (Na__FpNav__Suppressed) return;                                       // <-- Annotations layer owns this pointer

        const setup = Na__FpCfg__GetNavigationSetup();
        Na__FpNav__ActivePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (Na__FpNav__ActivePointers.size === 2 && setup.enableTouchPinch) {
            Na__FpNav__Dragging       = false;                                   // <-- Second finger cancels the pan
            Na__FpNav__LastPinchDist  = Na__FpNav__GetPinchDistance();
            return;
        }
        if (Na__FpNav__ActivePointers.size !== 1) return;

        const isTouch = event.pointerType !== 'mouse';
        if (isTouch && !setup.enableTouchPan) return;
        if (!isTouch && event.button !== setup.panButton) return;

        Na__FpNav__Dragging  = true;
        Na__FpNav__PointerId = event.pointerId;
        Na__FpNav__LastX     = event.clientX;
        Na__FpNav__LastY     = event.clientY;

        if (Na__FpNav__Canvas && Na__FpNav__Canvas.setPointerCapture) {
            Na__FpNav__Canvas.setPointerCapture(event.pointerId);                // <-- Keep the drag alive off-canvas
        }
        Na__RenderLoop__RequestActiveRender(Na__FpNav__RENDER_REASON);
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Pointer Move - Live Pan or Pinch Zoom
    // ------------------------------------------------------------
    function Na__FpNav__HandlePointerMove(event) {
        if (!Na__FpNav__ActivePointers.has(event.pointerId)) return;
        Na__FpNav__ActivePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        // PINCH ZOOM | Two fingers down
        if (Na__FpNav__ActivePointers.size === 2) {
            const distance = Na__FpNav__GetPinchDistance();
            if (Na__FpNav__LastPinchDist > 0 && distance > 0) {
                const centre = Na__FpNav__GetPinchCentre();
                Na__FpNav__ZoomAtCursor(distance / Na__FpNav__LastPinchDist, centre.x, centre.y);
            }
            Na__FpNav__LastPinchDist = distance;
            return;
        }

        // PAN | Single pointer drag
        if (!Na__FpNav__Dragging || event.pointerId !== Na__FpNav__PointerId) return;

        Na__FpNav__PanByScreenDelta(event.clientX - Na__FpNav__LastX, event.clientY - Na__FpNav__LastY);
        Na__FpNav__LastX = event.clientX;
        Na__FpNav__LastY = event.clientY;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Pointer Up - End the Pan or Pinch
    // ------------------------------------------------------------
    function Na__FpNav__HandlePointerUp(event) {
        Na__FpNav__ActivePointers.delete(event.pointerId);

        if (Na__FpNav__ActivePointers.size < 2) Na__FpNav__LastPinchDist = 0;

        if (event.pointerId !== Na__FpNav__PointerId) return;

        Na__FpNav__Dragging  = false;
        Na__FpNav__PointerId = null;

        if (Na__FpNav__Canvas && Na__FpNav__Canvas.releasePointerCapture) {
            try {
                Na__FpNav__Canvas.releasePointerCapture(event.pointerId);
            } catch (error) {
                // Capture may already have been lost; nothing to release.
            }
        }
        Na__RenderLoop__StopActiveRender(Na__FpNav__RENDER_REASON);
        Na__RenderLoop__RequestRender();
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Wheel - Zoom Toward the Cursor
    // ------------------------------------------------------------
    function Na__FpNav__HandleWheel(event) {
        if (Na__FpNav__Suppressed) return;
        event.preventDefault();                                                  // <-- Never let the page scroll behind the plan

        const setup    = Na__FpCfg__GetNavigationSetup();
        const zoomingIn = setup.invertWheel ? (event.deltaY > 0) : (event.deltaY < 0);
        const factor    = zoomingIn ? setup.zoomStepFactor : (1 / setup.zoomStepFactor);

        Na__FpNav__ZoomAtCursor(factor, event.clientX, event.clientY);
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Swallow the Context Menu While Panning
    // ------------------------------------------------------------
    function Na__FpNav__HandleContextMenu(event) {
        if (Na__FpNav__Dragging) event.preventDefault();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Attachment
// -----------------------------------------------------------------------------

    // FUNCTION | Bind Plan Navigation to the Canvas
    // ------------------------------------------------------------
    function Na__FpNav__Attach(canvas) {
        if (Na__FpNav__Attached || !canvas) return false;

        Na__FpNav__Canvas = canvas;
        canvas.addEventListener('pointerdown',   Na__FpNav__HandlePointerDown);
        canvas.addEventListener('pointermove',   Na__FpNav__HandlePointerMove);
        canvas.addEventListener('pointerup',     Na__FpNav__HandlePointerUp);
        canvas.addEventListener('pointercancel', Na__FpNav__HandlePointerUp);
        canvas.addEventListener('wheel',         Na__FpNav__HandleWheel, { passive: false });
        canvas.addEventListener('contextmenu',   Na__FpNav__HandleContextMenu);

        Na__FpNav__Attached = true;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Unbind Plan Navigation and Clear All Drag State
    // ------------------------------------------------------------
    function Na__FpNav__Detach() {
        if (!Na__FpNav__Attached || !Na__FpNav__Canvas) return false;

        const canvas = Na__FpNav__Canvas;
        canvas.removeEventListener('pointerdown',   Na__FpNav__HandlePointerDown);
        canvas.removeEventListener('pointermove',   Na__FpNav__HandlePointerMove);
        canvas.removeEventListener('pointerup',     Na__FpNav__HandlePointerUp);
        canvas.removeEventListener('pointercancel', Na__FpNav__HandlePointerUp);
        canvas.removeEventListener('wheel',         Na__FpNav__HandleWheel);
        canvas.removeEventListener('contextmenu',   Na__FpNav__HandleContextMenu);

        Na__FpNav__ActivePointers.clear();
        Na__FpNav__Dragging      = false;
        Na__FpNav__PointerId     = null;
        Na__FpNav__LastPinchDist = 0;
        Na__FpNav__Suppressed    = false;
        Na__FpNav__Attached      = false;
        Na__FpNav__Canvas        = null;

        Na__RenderLoop__StopActiveRender(Na__FpNav__RENDER_REASON);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Suppress Panning While Another Layer Owns the Pointer
    // ------------------------------------------------------------
    // Raised by the annotations editor while text is being dragged or edited,
    // so moving a room label never drags the drawing underneath it.
    // ------------------------------------------------------------
    function Na__FpNav__SetSuppressed(suppressed) {
        Na__FpNav__Suppressed = (suppressed === true);
        if (Na__FpNav__Suppressed) {
            Na__FpNav__Dragging  = false;
            Na__FpNav__PointerId = null;
            Na__FpNav__ActivePointers.clear();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Plan Navigation Currently Bound?
    // ------------------------------------------------------------
    function Na__FpNav__IsAttached() {
        return Na__FpNav__Attached;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Navigation API
    // ------------------------------------------------------------
    export {
        Na__FpNav__Attach,
        Na__FpNav__Detach,
        Na__FpNav__SetSuppressed,
        Na__FpNav__IsAttached
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
