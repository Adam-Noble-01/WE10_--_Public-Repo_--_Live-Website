// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - WEB VIEWER - TOUCH SCREEN CONTROLS
// =============================================================================
//
// FILE       : Na__LayoutEditor__WebViewer__TouchControls__.js
// NAMESPACE  : Na__LeVwTouch
// MODULE     : Layout Editor - Web Viewer - Touch Screen Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Recognise the finger gestures a document viewer needs, and hand them to whoever is showing the document
// CREATED    : 18-Sep-2026
//
// DESCRIPTION:
// - THE VIEWER IS READ ON A PHONE, HELD IN ONE HAND, IN PORTRAIT. That is the
//   whole reason this module exists. The editor's touch controls
//   (Na__LayoutEditor__Controls__TouchScreen__) arbitrate between navigating and
//   EDITING, so they reserve the second finger for navigation and leave the
//   first one free to drag sheet items about. A viewer edits nothing, so the
//   first finger is free, and the gesture set people already expect from every
//   photo and PDF app on the phone becomes available: drag to pan, pinch to
//   zoom, double tap to fit, and swipe sideways for the next document.
// - THIS MODULE RECOGNISES GESTURES AND NOTHING ELSE. It knows nothing about
//   sheets, specifications, zoom maths or which document is showing: it is
//   attached to an element with a set of handlers and it calls them. Both
//   viewer modules (drawings and specification) attach the same recogniser to
//   their own surface and answer the same questions, so a gesture means the
//   same thing wherever the reader is.
// - A PAGE TURN IS THE SURFACE'S TO ASK FOR. Only a surface that hands over an
//   onSwipe handler gets one, and only from travel it could not use itself. The
//   specification's pages take it, because nothing there uses the sideways
//   direction. A DRAWING DOES NOT: one finger pans it, and a sheet fitted to
//   the screen has no panning left to do, so every sideways pixel would read as
//   spare and the document would change under a reader who was only trying to
//   move the drawing.
// - ONE APPLICATION PER PAINTED FRAME. Moves are gathered as they arrive and
//   applied in a requestAnimationFrame, because a tablet reports touch far
//   faster than it paints and each application has to measure the page it has
//   just resized.
// - Vertical intent wins outright: a drag that is mostly up or down can never
//   become a swipe, so scrolling the specification is never mistaken for
//   asking for the next document.
//
// INTEGRATION:
// - Na__LayoutEditor__WebViewer__Drawings__ and ...__Spec__ attach and detach.
// - Tuning: LayoutEditor__WebViewer__Config in Na__LayoutEditor__AppConfig__.json
//   for the swipe, and the shared TouchBindings key map for the double tap.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none. TrueVision original.
// - Back-port     : candidate (ValeVision has no web viewer).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 18-Sep-2026 - Version 1.1.0
// - Moves are gathered and applied once per animation frame. Applying per event
//   measured the stage and the paper immediately after resizing them, several
//   times per painted frame on a tablet, and the gesture dragged behind the
//   finger (Adam, on an iPad: "zoom and pan feel weird and kind of sticky").
// - A page turn now needs the surface to have asked for one. A drawing no
//   longer turns the page at all: fitted to the screen it has no panning left
//   to spend, so every sideways drag was reading as a page turn (Adam: "it
//   tries to change to next tab as i try to pan on the main canvas").
//
// 18-Sep-2026 - Version 1.0.0
// - Initial implementation for the public web viewer.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Key Map and Viewer Setup
    // ------------------------------------------------------------
    import { Na__LeCfg__GetTouchSetup, Na__LeCfg__GetWebViewerSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Class Worn While a Gesture Owns the Surface
    // ------------------------------------------------------------
    const Na__LeVwTouch__BUSY_CLASS = 'na-le-viewer--gesturing';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Attached Target, Handlers and Gesture State
    // ------------------------------------------------------------
    let   Na__LeVwTouch__Target   = null;
    let   Na__LeVwTouch__Handlers = null;
    let   Na__LeVwTouch__Bound    = null;                                        // <-- The listener set, kept so detach removes the same functions
    let   Na__LeVwTouch__Swallow  = true;                                        // <-- Whether a drag takes the gesture away from the browser
    const Na__LeVwTouch__Points   = new Map();                                   // <-- pointerId -> { x, y, startX, startY }
    let   Na__LeVwTouch__Drag     = null;                                        // <-- One finger: { pointerId, moved, budget, vertical }
    let   Na__LeVwTouch__Pinch    = null;                                        // <-- Two fingers: { distance, midX, midY }
    let   Na__LeVwTouch__LastTap  = null;                                        // <-- { time, x, y } for the double tap
    let   Na__LeVwTouch__Swiped   = false;                                       // <-- One page turn per gesture, however far the finger goes on
    let   Na__LeVwTouch__Pending  = null;                                        // <-- { panX, panY, scale, cx, cy } gathered since the last frame
    let   Na__LeVwTouch__Frame    = 0;                                           // <-- The requestAnimationFrame that will apply it
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Handler Calls
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ask a Handler, Tolerating One That Was Not Given
    // ------------------------------------------------------------
    function Na__LeVwTouch__Ask(name, a, b, c) {
        const fn = Na__LeVwTouch__Handlers ? Na__LeVwTouch__Handlers[name] : null;
        return (typeof fn === 'function') ? fn(a, b, c) : undefined;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Gather This Move, and Book a Frame to Apply It In
    // ------------------------------------------------------------
    // ONE APPLICATION PER PAINTED FRAME, NOT ONE PER EVENT. A pan and a pinch
    // both end in a scroll position and a zoom, and working either out means
    // measuring the stage and the paper - a layout read - immediately after
    // writing new sizes to them. A tablet reports touch moves far faster than
    // it paints, so doing that per event forces the browser to lay the page out
    // several times for every frame it shows, and the gesture arrives late and
    // drags behind the finger. Gathering costs nothing; the frame does the work
    // once, with the newest numbers.
    // ------------------------------------------------------------
    function Na__LeVwTouch__Gather(panX, panY, scale, cx, cy) {
        if (!Na__LeVwTouch__Pending) Na__LeVwTouch__Pending = { panX : 0, panY : 0, scale : 1, cx : cx, cy : cy };
        const p = Na__LeVwTouch__Pending;
        p.panX += panX;
        p.panY += panY;
        p.scale *= scale;
        p.cx = cx;                                                               // <-- The pinch anchors on where the fingers are NOW
        p.cy = cy;
        if (!Na__LeVwTouch__Frame) Na__LeVwTouch__Frame = window.requestAnimationFrame(Na__LeVwTouch__Apply);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Everything Gathered Since the Last Frame
    // ------------------------------------------------------------
    // Zoom first, then pan: the pan is clamped against the paper, and after a
    // pinch the paper is a different size, so the clamp has to be worked out
    // from where things have just ended up rather than where they were.
    //
    // onPan may answer { x, y } saying how many pixels it actually moved. An
    // answer of nothing is read as "all of it", which is the right default for
    // a surface that scrolls freely. The unused horizontal remainder is what a
    // page turn is built from, on a surface that asks for one.
    // ------------------------------------------------------------
    function Na__LeVwTouch__Apply() {
        Na__LeVwTouch__Frame = 0;
        const p = Na__LeVwTouch__Pending;
        Na__LeVwTouch__Pending = null;
        if (!p) return;

        if (p.scale !== 1) Na__LeVwTouch__Ask('onPinch', p.scale, p.cx, p.cy);
        if (!p.panX && !p.panY) return;

        const used  = Na__LeVwTouch__Ask('onPan', p.panX, p.panY);
        const usedX = (used && Number.isFinite(used.x)) ? used.x : p.panX;
        if (Na__LeVwTouch__Drag && !Na__LeVwTouch__Drag.vertical) {
            Na__LeVwTouch__Drag.budget += (p.panX - usedX);                      // <-- Horizontal overscroll only; vertical never turns a page
            Na__LeVwTouch__TestSwipe();
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop a Gathered Gesture Without Applying It
    // ------------------------------------------------------------
    function Na__LeVwTouch__Cancel() {
        if (Na__LeVwTouch__Frame) window.cancelAnimationFrame(Na__LeVwTouch__Frame);
        Na__LeVwTouch__Frame   = 0;
        Na__LeVwTouch__Pending = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Gesture Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Midpoint and Spread of the Two Live Touches
    // ------------------------------------------------------------
    function Na__LeVwTouch__Span() {
        const points = Array.from(Na__LeVwTouch__Points.values());
        if (points.length < 2) return null;
        return {
            midX     : (points[0].x + points[1].x) / 2,
            midY     : (points[0].y + points[1].y) / 2,
            distance : Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Mark the Surface Busy So Nothing Else Reads the Gesture
    // ------------------------------------------------------------
    function Na__LeVwTouch__Busy(flag) {
        if (!Na__LeVwTouch__Target) return;
        Na__LeVwTouch__Target.classList.toggle(Na__LeVwTouch__BUSY_CLASS, !!flag);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Second Tap in the Same Place, Soon Enough
    // ------------------------------------------------------------
    function Na__LeVwTouch__TestDoubleTap(point) {
        const setup = Na__LeCfg__GetTouchSetup();
        if (!setup.doubleTapFit) return;
        const now  = Date.now();
        const last = Na__LeVwTouch__LastTap;
        if (last && (now - last.time) <= setup.doubleTapWindowMs
                 && Math.hypot(point.x - last.x, point.y - last.y) <= setup.doubleTapSlopPx) {
            Na__LeVwTouch__LastTap = null;
            Na__LeVwTouch__Ask('onDoubleTap', point.x, point.y);
            return;
        }
        Na__LeVwTouch__LastTap = { time : now, x : point.x, y : point.y };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Spend the Overscroll Budget on a Page Turn
    // ------------------------------------------------------------
    // The budget is signed the way the content travels: a finger moving LEFT
    // drags the paper leftwards, asking for what is further on, so a positive
    // budget is the next document and a negative one the previous.
    //
    // ONLY A SURFACE THAT ASKED FOR IT TURNS PAGES. A drawing does not: one
    // finger pans it, and a sheet that is fitted has no panning left to do, so
    // EVERY sideways pixel reads as spare and the page turns the moment a
    // reader drags across a drawing they were only trying to move. Handing the
    // page turn to whichever surface can spare the direction, rather than to
    // the recogniser, is what keeps a pan a pan.
    // ------------------------------------------------------------
    function Na__LeVwTouch__TestSwipe() {
        if (Na__LeVwTouch__Swiped || !Na__LeVwTouch__Drag) return;
        if (typeof (Na__LeVwTouch__Handlers && Na__LeVwTouch__Handlers.onSwipe) !== 'function') return;
        const setup = Na__LeCfg__GetWebViewerSetup();
        if (!setup.swipeEnabled) return;
        if (Math.abs(Na__LeVwTouch__Drag.budget) < setup.swipeMinPx) return;
        Na__LeVwTouch__Swiped = true;
        Na__LeVwTouch__Ask('onSwipe', Na__LeVwTouch__Drag.budget > 0 ? 'next' : 'previous');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Gestures
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Pointer Down: Register a Finger and Open a Gesture
    // ------------------------------------------------------------
    function Na__LeVwTouch__OnPointerDown(event) {
        if (event.pointerType !== 'touch') return;                               // <-- Mouse and pen keep the PC controls
        if (event.target && event.target.closest && event.target.closest('button, a, input, select, textarea')) return;   // <-- A control on the surface is pressed, not dragged

        Na__LeVwTouch__Points.set(event.pointerId, { x : event.clientX, y : event.clientY, startX : event.clientX, startY : event.clientY });

        // ONE FINGER | A candidate. It only becomes a drag once it has moved.
        // ------------------------------------------------------------
        if (Na__LeVwTouch__Points.size === 1) {
            Na__LeVwTouch__Drag   = { pointerId : event.pointerId, moved : false, budget : 0, vertical : false };
            Na__LeVwTouch__Swiped = false;
            return;
        }

        // TWO FINGERS | The pinch takes over, whatever the first finger was doing.
        // ------------------------------------------------------------
        if (Na__LeVwTouch__Points.size === 2) {
            const span = Na__LeVwTouch__Span();
            Na__LeVwTouch__Drag  = null;
            Na__LeVwTouch__Pinch = span ? { distance : span.distance, midX : span.midX, midY : span.midY } : null;
            Na__LeVwTouch__Busy(true);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Move: Pinch, Pan, and Build the Swipe Budget
    // ------------------------------------------------------------
    function Na__LeVwTouch__OnPointerMove(event) {
        const point = Na__LeVwTouch__Points.get(event.pointerId);
        if (!point) return;
        const dx = event.clientX - point.x;
        const dy = event.clientY - point.y;
        point.x  = event.clientX;
        point.y  = event.clientY;

        // TWO FINGERS | Zoom about the midpoint, and pan with it
        // ------------------------------------------------------------
        if (Na__LeVwTouch__Pinch && Na__LeVwTouch__Points.size >= 2) {
            const span = Na__LeVwTouch__Span();
            if (!span) return;
            const setup  = Na__LeCfg__GetTouchSetup();
            const movedX = setup.twoFingerPan ? (span.midX - Na__LeVwTouch__Pinch.midX) : 0;
            const movedY = setup.twoFingerPan ? (span.midY - Na__LeVwTouch__Pinch.midY) : 0;
            const scale  = (setup.pinchZoom && Na__LeVwTouch__Pinch.distance > 0 && span.distance > 0)
                         ? (span.distance / Na__LeVwTouch__Pinch.distance) : 1;
            if (movedX || movedY || scale !== 1) Na__LeVwTouch__Gather(-movedX, -movedY, scale, span.midX, span.midY);
            Na__LeVwTouch__Pinch = { distance : span.distance, midX : span.midX, midY : span.midY };
            if (Na__LeVwTouch__Swallow && event.cancelable) event.preventDefault();
            return;
        }

        // ONE FINGER | Pan the surface, and keep what it could not use
        // ------------------------------------------------------------
        if (!Na__LeVwTouch__Drag || Na__LeVwTouch__Drag.pointerId !== event.pointerId) return;
        if (!Na__LeVwTouch__Drag.moved) {
            const setup     = Na__LeCfg__GetTouchSetup();
            const travelled = Math.hypot(event.clientX - point.startX, event.clientY - point.startY);
            if (travelled < setup.panStartSlopPx) return;                        // <-- A finger that lands and lifts is a tap, not a nudge
            Na__LeVwTouch__Drag.moved    = true;
            // THE FIRST REAL MOVEMENT DECIDES WHAT THE GESTURE IS ABOUT. A drag
            // that starts vertically is reading down the page and stays a pan
            // for its whole length, so a wandering thumb never turns a page.
            Na__LeVwTouch__Drag.vertical = Math.abs(event.clientY - point.startY) > Math.abs(event.clientX - point.startX);
            Na__LeVwTouch__Busy(true);
        }
        Na__LeVwTouch__Gather(-dx, -dy, 1, event.clientX, event.clientY);
        if (Na__LeVwTouch__Swallow && event.cancelable) event.preventDefault();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Refuse WebKit's Page Pinch
    // ------------------------------------------------------------
    // gesturestart / gesturechange / gestureend are Safari's own, fired for the
    // pinch that zooms the page. Refusing them leaves the pointer events - and
    // so this module's own pinch - untouched.
    // ------------------------------------------------------------
    function Na__LeVwTouch__OnWebkitGesture(event) {
        if (event.cancelable) event.preventDefault();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Up: Close the Gesture, or Read It as a Tap
    // ------------------------------------------------------------
    function Na__LeVwTouch__OnPointerUp(event) {
        const point = Na__LeVwTouch__Points.get(event.pointerId);
        Na__LeVwTouch__Points.delete(event.pointerId);

        // FLUSHED BEFORE THE DRAG IS LET GO, and that order is the whole point.
        // A quick flick can begin and end inside a single painted frame, so
        // everything it asked for is still sitting in the pending gesture when
        // the finger lifts. Applying it after clearing the drag would throw the
        // page turn away with it, and the flick would do nothing at all.
        if (Na__LeVwTouch__Frame) { window.cancelAnimationFrame(Na__LeVwTouch__Frame); Na__LeVwTouch__Apply(); }

        if (Na__LeVwTouch__Drag && Na__LeVwTouch__Drag.pointerId === event.pointerId) {
            if (!Na__LeVwTouch__Drag.moved && point) Na__LeVwTouch__TestDoubleTap(point);
            Na__LeVwTouch__Drag = null;
        }
        if (Na__LeVwTouch__Points.size < 2) Na__LeVwTouch__Pinch = null;
        if (Na__LeVwTouch__Points.size === 0) {
            Na__LeVwTouch__Swiped = false;
            Na__LeVwTouch__Busy(false);
            Na__LeVwTouch__Ask('onGestureEnd');
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Attach the Recogniser to a Surface
    // ------------------------------------------------------------
    // handlers:
    //   onPan(dx, dy)                -> optionally { x, y } actually moved
    //   onPinch(factor, x, y)        -> multiply the zoom about that point
    //   onDoubleTap(x, y)
    //   onSwipe('next' | 'previous')
    //   onGestureEnd()
    //
    // options: { swallow } - false leaves the drag with the browser, so a
    // surface that scrolls itself keeps its native momentum and rubber band and
    // this module only watches the travel. Such a surface must declare its own
    // touch-action (pan-y on the specification pages), because it is then the
    // browser, not this module, deciding what a finger may do.
    // ------------------------------------------------------------
    function Na__LeVwTouch__Attach(target, handlers, options) {
        if (!target) return false;
        Na__LeVwTouch__Detach();
        Na__LeVwTouch__Target   = target;
        Na__LeVwTouch__Handlers = handlers || {};
        Na__LeVwTouch__Swallow  = !(options && options.swallow === false);
        Na__LeVwTouch__Bound    = {
            pointerdown   : Na__LeVwTouch__OnPointerDown,
            pointermove   : Na__LeVwTouch__OnPointerMove,
            pointerup     : Na__LeVwTouch__OnPointerUp,
            pointercancel : Na__LeVwTouch__OnPointerUp
        };
        // pointermove is NOT passive: a pinch and a pan both call preventDefault
        // so the browser does not also scroll the page under the reader.
        target.addEventListener('pointerdown',   Na__LeVwTouch__Bound.pointerdown);
        target.addEventListener('pointermove',   Na__LeVwTouch__Bound.pointermove, { passive : false });
        target.addEventListener('pointerup',     Na__LeVwTouch__Bound.pointerup);
        target.addEventListener('pointercancel', Na__LeVwTouch__Bound.pointercancel);

        // SAFARI PINCHES THE WHOLE PAGE, AND touch-action DOES NOT STOP IT.
        // On iOS a two-finger pinch zooms the visual viewport whatever the
        // element underneath declares, so a reader pinching a drawing was
        // zooming the sheet and the page at once - the sheet growing under
        // fingers that were also stretching the browser around it, which is
        // most of what "weird and sticky" was. WebKit fires its own gesture
        // events for that zoom and they can be refused. Bound only where this
        // module does the pinching itself: the specification's pages hand over
        // no onPinch, so a reader can still pinch them to read finer print.
        if (typeof Na__LeVwTouch__Handlers.onPinch === 'function') {
            Na__LeVwTouch__Bound.gesturestart  = Na__LeVwTouch__OnWebkitGesture;
            Na__LeVwTouch__Bound.gesturechange = Na__LeVwTouch__OnWebkitGesture;
            Na__LeVwTouch__Bound.gestureend    = Na__LeVwTouch__OnWebkitGesture;
            target.addEventListener('gesturestart',  Na__LeVwTouch__Bound.gesturestart,  { passive : false });
            target.addEventListener('gesturechange', Na__LeVwTouch__Bound.gesturechange, { passive : false });
            target.addEventListener('gestureend',    Na__LeVwTouch__Bound.gestureend,    { passive : false });
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Let the Surface Go
    // ------------------------------------------------------------
    function Na__LeVwTouch__Detach() {
        if (Na__LeVwTouch__Target && Na__LeVwTouch__Bound) {
            Object.keys(Na__LeVwTouch__Bound).forEach((name) => {
                Na__LeVwTouch__Target.removeEventListener(name, Na__LeVwTouch__Bound[name]);
            });
            Na__LeVwTouch__Busy(false);
        }
        Na__LeVwTouch__Cancel();
        Na__LeVwTouch__Points.clear();
        Na__LeVwTouch__Target = Na__LeVwTouch__Handlers = Na__LeVwTouch__Bound = null;
        Na__LeVwTouch__Drag   = Na__LeVwTouch__Pinch = Na__LeVwTouch__LastTap = null;
        Na__LeVwTouch__Swiped = false;
        Na__LeVwTouch__Swallow = true;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does This Device Have a Finger on It
    // ------------------------------------------------------------
    // Asked only to decide whether to SAY "swipe for the next drawing". The
    // gestures themselves are never gated on it: a laptop with a touchscreen
    // answers whatever it answers, and the recogniser works either way.
    // ------------------------------------------------------------
    function Na__LeVwTouch__IsTouchDevice() {
        try {
            if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
            return (navigator.maxTouchPoints || 0) > 0;
        } catch (error) { return false; }
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Gesture Running Right Now
    // ------------------------------------------------------------
    function Na__LeVwTouch__IsGesturing() { return Na__LeVwTouch__Points.size > 0; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Web Viewer Touch Controls API
    // ------------------------------------------------------------
    export {
        Na__LeVwTouch__Attach,
        Na__LeVwTouch__Detach,
        Na__LeVwTouch__IsTouchDevice,
        Na__LeVwTouch__IsGesturing
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
