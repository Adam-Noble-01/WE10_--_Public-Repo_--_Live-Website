// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CONTROLS - TOUCHSCREEN
// =============================================================================
//
// FILE       : Na__LayoutEditor__Controls__TouchScreen__.js
// NAMESPACE  : Na__LeTouch
// MODULE     : Layout Editor - Touchscreen Controls
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Pan, pinch zoom and double tap to fit on a touchscreen, resolved through the key map
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - TWO FINGERS ALWAYS NAVIGATE. That is the whole arbitration: because a
//   navigation gesture needs a second finger, one finger stays free to select,
//   drag and resize sheet contents, and neither gesture has to guess what the
//   other meant. Two fingers pinch to zoom about the midpoint and drag to pan.
// - ONE FINGER ALSO PANS FROM THE GREY STAGE. A press that lands off the paper
//   cannot be an edit, so it pans. Without this a tablet user who has zoomed in
//   has to find a second finger before the sheet will move at all, which is the
//   state the editor was in before this module existed: the stage sets
//   touch-action none, so the browser will not scroll it for us, and the sheet
//   tools treat every touch as a left button press.
// - A tap is protected by a slop radius, so a finger that lands and lifts still
//   selects rather than nudging the view. A double tap on the stage fits.
// - Whenever a touch gesture takes over, the sheet tools suppression flag is
//   raised for the length of it, so a second finger can never leave a half
//   finished drag behind on the sheet.
// - NOTHING HERE IS BOUND TO A FIXED GESTURE. Every switch, slop and timing
//   value is read from Na__LayoutEditor__KeyMappings__.json through the config
//   state, so touch behaviour is personalised in the same file as the mouse.
//
// INTEGRATION:
// - Na__LayoutEditor__ModeController__ attaches on entering the editor and
//   detaches on leaving it. Attach before the sheet tools so suppression is
//   raised before the tools see the press.
// - Movement goes through Na__LayoutEditor__Navigation__, which owns the zoom
//   maths, the fit and the scroll.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Controls__TouchScreen__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__Navigation__, whose pinch was the only touch
//   gesture the editor had and which left no way to pan with a finger.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Key Map, Navigation and Surface
    // ------------------------------------------------------------
    import { Na__LeCfg__GetGuards, Na__LeCfg__GetTouchSetup } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeNav__ZoomAbout,
        Na__LeNav__Fit,
        Na__LeNav__PanBy
    } from './Na__LayoutEditor__Navigation__.js';
    import { Na__LeSurface__GetElements, Na__LeSurface__GetZoom } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeTools__SetSuppressed } from './Na__LayoutEditor__SheetTools__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Panning Class Shared With the PC Controls
    // ------------------------------------------------------------
    const Na__LeTouch__PANNING_CLASS = 'na-le-stage--panning';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Attached Stage and Gesture State
    // ------------------------------------------------------------
    let Na__LeTouch__Stage     = null;
    let Na__LeTouch__Handlers  = null;
    const Na__LeTouch__Points  = new Map();                                      // <-- pointerId -> { x, y, startX, startY, onPaper }
    let Na__LeTouch__Single    = null;                                           // <-- { pointerId, panning } one finger candidate
    let Na__LeTouch__Pinch     = null;                                           // <-- { distance, zoom, midX, midY }
    let Na__LeTouch__Suppressed = false;
    let Na__LeTouch__LastTap   = null;                                           // <-- { time, x, y } for the double tap
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Gesture Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Test an Event Target Against a Guard Selector
    // ------------------------------------------------------------
    function Na__LeTouch__Matches(event, selector) {
        if (!selector) return false;
        const target = event.target;
        return !!(target && target.closest && target.closest(selector));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Raise or Drop the Sheet Tools Suppression Flag
    // ------------------------------------------------------------
    // Held as our own flag so the tools are only told when the state changes,
    // and so a detach mid gesture can always put them back.
    function Na__LeTouch__Suppress(flag) {
        if (Na__LeTouch__Suppressed === flag) return;
        Na__LeTouch__Suppressed = flag;
        Na__LeTools__SetSuppressed(flag);
        if (flag) Na__LeTouch__Stage.classList.add(Na__LeTouch__PANNING_CLASS);
        else      Na__LeTouch__Stage.classList.remove(Na__LeTouch__PANNING_CLASS);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Midpoint and Spread of the Two Live Touches
    // ------------------------------------------------------------
    function Na__LeTouch__Span() {
        const points = Array.from(Na__LeTouch__Points.values());
        if (points.length < 2) return null;
        return {
            midX     : (points[0].x + points[1].x) / 2,
            midY     : (points[0].y + points[1].y) / 2,
            distance : Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether One Finger Is Allowed to Pan From Where It Landed
    // ------------------------------------------------------------
    function Na__LeTouch__OneFingerMayPan(onPaper) {
        const setup = Na__LeCfg__GetTouchSetup();
        if (setup.oneFingerPanOnPaper) return true;
        return setup.oneFingerPanOnStage && !onPaper;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fit on a Second Tap in the Same Place
    // ------------------------------------------------------------
    function Na__LeTouch__TestDoubleTap(point) {
        const setup = Na__LeCfg__GetTouchSetup();
        if (!setup.doubleTapFit) return;
        const now  = Date.now();
        const last = Na__LeTouch__LastTap;
        if (last && (now - last.time) <= setup.doubleTapWindowMs
                 && Math.hypot(point.x - last.x, point.y - last.y) <= setup.doubleTapSlopPx) {
            Na__LeTouch__LastTap = null;
            Na__LeNav__Fit();
            return;
        }
        Na__LeTouch__LastTap = { time : now, x : point.x, y : point.y };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Gestures
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Pointer Down: Register a Touch and Open a Gesture
    // ------------------------------------------------------------
    function Na__LeTouch__OnPointerDown(event) {
        if (event.pointerType !== 'touch') return;                                            // <-- The PC module owns mouse and pen
        const guards = Na__LeCfg__GetGuards();
        if (Na__LeTouch__Matches(event, guards.pointerIgnoreSelector)) return;                 // <-- A viewport canvas keeps its own gesture

        const onPaper = Na__LeTouch__Matches(event, guards.paperSelector);
        Na__LeTouch__Points.set(event.pointerId, {
            x : event.clientX, y : event.clientY, startX : event.clientX, startY : event.clientY, onPaper : onPaper
        });

        // ONE FINGER | Held as a candidate; it only becomes a pan once it moves
        // ------------------------------------------------------------
        if (Na__LeTouch__Points.size === 1) {
            Na__LeTouch__Single = Na__LeTouch__OneFingerMayPan(onPaper)
                ? { pointerId : event.pointerId, panning : false }
                : null;
            return;
        }

        // TWO FINGERS | Navigation takes over at once, whatever the first finger was doing
        // ------------------------------------------------------------
        if (Na__LeTouch__Points.size === 2) {
            const setup = Na__LeCfg__GetTouchSetup();
            if (!setup.pinchZoom && !setup.twoFingerPan) return;
            Na__LeTouch__Single = null;
            Na__LeTouch__LastTap = null;
            Na__LeTouch__Suppress(true);
            const span = Na__LeTouch__Span();
            if (span) Na__LeTouch__Pinch = { distance : span.distance, zoom : Na__LeSurface__GetZoom(), midX : span.midX, midY : span.midY };
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Move: Pan With One Finger, Pinch and Pan With Two
    // ------------------------------------------------------------
    function Na__LeTouch__OnPointerMove(event) {
        if (event.pointerType !== 'touch') return;
        const point = Na__LeTouch__Points.get(event.pointerId);
        if (!point) return;

        const previousX = point.x;
        const previousY = point.y;
        point.x = event.clientX;
        point.y = event.clientY;

        const setup = Na__LeCfg__GetTouchSetup();

        // TWO FINGERS | Zoom about the midpoint, then carry the midpoint along
        // ------------------------------------------------------------
        if (Na__LeTouch__Pinch && Na__LeTouch__Points.size >= 2) {
            const span = Na__LeTouch__Span();
            if (!span) return;
            if (setup.pinchZoom && Na__LeTouch__Pinch.distance > setup.pinchStartSlopPx) {
                Na__LeNav__ZoomAbout(Na__LeTouch__Pinch.zoom * (span.distance / Na__LeTouch__Pinch.distance), span.midX, span.midY);
            }
            if (setup.twoFingerPan) {
                Na__LeNav__PanBy(Na__LeTouch__Pinch.midX - span.midX, Na__LeTouch__Pinch.midY - span.midY);
            }
            Na__LeTouch__Pinch.midX = span.midX;
            Na__LeTouch__Pinch.midY = span.midY;
            return;
        }

        // ONE FINGER | Becomes a pan once it has travelled past the tap slop
        // ------------------------------------------------------------
        if (!Na__LeTouch__Single || Na__LeTouch__Single.pointerId !== event.pointerId) return;
        if (!Na__LeTouch__Single.panning) {
            if (Math.hypot(point.x - point.startX, point.y - point.startY) < setup.panStartSlopPx) return;
            Na__LeTouch__Single.panning = true;
            Na__LeTouch__LastTap = null;
            Na__LeTouch__Suppress(true);
        }
        Na__LeNav__PanBy(previousX - point.x, previousY - point.y);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Up or Cancel: Close the Gesture Down
    // ------------------------------------------------------------
    function Na__LeTouch__OnPointerUp(event) {
        if (event.pointerType !== 'touch') return;
        const point = Na__LeTouch__Points.get(event.pointerId);
        if (!point) return;
        Na__LeTouch__Points.delete(event.pointerId);

        const wasPanning = !!(Na__LeTouch__Single && Na__LeTouch__Single.pointerId === event.pointerId && Na__LeTouch__Single.panning);
        const wasPinch   = !!Na__LeTouch__Pinch;

        if (Na__LeTouch__Points.size < 2) Na__LeTouch__Pinch = null;
        if (Na__LeTouch__Single && Na__LeTouch__Single.pointerId === event.pointerId) Na__LeTouch__Single = null;

        // A LIFT THAT NEVER MOVED | Still a tap, so it can complete a double tap
        // ------------------------------------------------------------
        if (!wasPanning && !wasPinch && event.type === 'pointerup' && !point.onPaper) {
            const setup = Na__LeCfg__GetTouchSetup();
            if (Math.hypot(point.x - point.startX, point.y - point.startY) <= setup.doubleTapSlopPx) {
                Na__LeTouch__TestDoubleTap({ x : point.x, y : point.y });
            }
        }

        if (Na__LeTouch__Points.size === 0) Na__LeTouch__Suppress(false);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Attach and Detach
// -----------------------------------------------------------------------------

    // FUNCTION | Listen on the Stage
    // ------------------------------------------------------------
    function Na__LeTouch__Attach() {
        const els = Na__LeSurface__GetElements();
        if (!els.stage) return false;
        Na__LeTouch__Detach();
        Na__LeTouch__Stage    = els.stage;
        Na__LeTouch__Handlers = {
            pointerdown   : (e) => Na__LeTouch__OnPointerDown(e),
            pointermove   : (e) => Na__LeTouch__OnPointerMove(e),
            pointerup     : (e) => Na__LeTouch__OnPointerUp(e),
            pointercancel : (e) => Na__LeTouch__OnPointerUp(e)
        };
        [ 'pointerdown', 'pointermove', 'pointerup', 'pointercancel' ].forEach((name) => {
            Na__LeTouch__Stage.addEventListener(name, Na__LeTouch__Handlers[name]);
        });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Listening and Drop Any Gesture
    // ------------------------------------------------------------
    function Na__LeTouch__Detach() {
        if (!Na__LeTouch__Stage || !Na__LeTouch__Handlers) return;
        Na__LeTouch__Suppress(false);                                                          // <-- Never leave the tools suppressed
        [ 'pointerdown', 'pointermove', 'pointerup', 'pointercancel' ].forEach((name) => {
            Na__LeTouch__Stage.removeEventListener(name, Na__LeTouch__Handlers[name]);
        });
        Na__LeTouch__Points.clear();
        Na__LeTouch__Stage = Na__LeTouch__Handlers = Na__LeTouch__Single = Na__LeTouch__Pinch = null;
        Na__LeTouch__LastTap = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Touchscreen Controls API
    // ------------------------------------------------------------
    export {
        Na__LeTouch__Attach,
        Na__LeTouch__Detach
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
