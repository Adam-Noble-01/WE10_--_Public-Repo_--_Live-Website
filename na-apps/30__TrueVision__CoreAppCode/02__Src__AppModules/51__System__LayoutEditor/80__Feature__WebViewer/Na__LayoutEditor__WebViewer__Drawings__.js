// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - WEB VIEWER - DRAWINGS (READ ONLY)
// =============================================================================
//
// FILE       : Na__LayoutEditor__WebViewer__Drawings__.js
// NAMESPACE  : Na__LeVwDraw
// MODULE     : Layout Editor - Web Viewer - Read-Only Drawings
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Show a drawing sheet to a reader on the live web: look at it, move around it, and nothing else
// CREATED    : 18-Sep-2026
//
// DESCRIPTION:
// - THE READ-ONLY DRAWING SURFACE. The sheet surface is mounted read-only by
//   the mode controller either way; what this module owns is the INPUT. The
//   editor attaches Na__LeTools__ (select, drag, resize, draw, the context
//   menu, the measurements box) and the margin grip. The viewer attaches none
//   of them, so there is nothing on the paper to press: the only things bound
//   are the PC navigation controls (wheel zoom, drag pan, the navigation keys -
//   they run zoom and pan actions only, edit actions belong to the tools) and
//   the viewer's touch recogniser.
// - Not attaching is the whole security model here, and it is the honest one.
//   The alternative - attaching the editing tools and disabling each thing they
//   can do - has been the source of every read-only leak this codebase has had:
//   one new tool, one forgotten guard, and a web reader can drag a viewport.
//   A tool that was never attached cannot leak.
// - FIT FIRST, THEN PINCH. A reader opening a drawing on a phone wants the
//   whole sheet, so every document change fits the paper. Double tap magnifies
//   about the point tapped, and double tap again returns to the whole sheet.
// - ONE FINGER PANS, AND ONLY PANS. The recogniser can turn a page out of
//   travel a surface could not use, and this surface does not ask it to: a
//   fitted sheet can use no sideways travel at all, so the document would
//   change under anyone who dragged across a drawing they were moving.
//
// INTEGRATION:
// - Na__LayoutEditor__WebViewer__ attaches on showing a drawing and detaches on
//   leaving it, and is told which way a swipe went.
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
// 18-Nov-2026 - Version 1.3.0 (TrueVision3D v2.189.1)
// - Adam, on an iPad with TV05's published D01: "it seems to jump in like
//   massive chunks of zoom you can't use two fingers to pan around".
// - A PINCH IS A ZOOM GESTURE, as the wheel's is. Its zoom now tells the sheet
//   surface so (ZoomAbout's gesture argument), and everything that follows a
//   zoom - the redraw of the whole sheet, the grid, Draft mode - waits until
//   the fingers rest. Before, every frame of a pinch announced a settled zoom
//   and the browser laid out and painted the whole sheet again under the
//   fingers: 32 settles in one 32-step pinch, measured on TV05 D01.
// - EASED ZOOMS. The dock's - and + (now 1.25 a press), a double tap and the
//   dock's Fit glide over EASE_MS instead of landing in one frame, each frame
//   a gesture step, so the sheet is drawn crisp ONCE when the glide rests.
//   Presses in quick succession stack on the glide's target.
// - A double tap on a magnified sheet glides back to the whole sheet, about
//   the one point that lands it exactly where Fit puts it.
// - The touch recogniser is asked for its fling (inertia) on this surface.
//
// 19-Oct-2026 - Version 1.2.0
// - A finger's single tap is offered to a tap handler first (SetTapHandler,
//   the web viewer's measuring tools, TrueVision3D v2.180.0). One it uses is
//   not the first half of a double tap; one it does not use is left alone.
//
// 18-Sep-2026 - Version 1.1.0
// - The page turn is gone from this surface (Adam, on an iPad: "it tries to
//   change to next tab as i try to pan on the main canvas"). A fitted sheet has
//   no panning to spend, so every sideways drag was spare travel and read as a
//   page turn.
// - The pan measures the stage and the paper once for both axes and works out
//   what landed instead of reading the scroll back, which forced a layout in
//   the middle of a live gesture.
//
// 18-Sep-2026 - Version 1.0.0
// - Initial implementation for the public web viewer.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Surface, Navigation, PC Controls and Touch
    // ------------------------------------------------------------
    import { Na__LeCfg__GetNavigationSetup, Na__LeCfg__GetWebViewerSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeSurface__GetElements,
        Na__LeSurface__GetLayout,
        Na__LeSurface__GetZoom,
        Na__LeSurface__GetPixelsPerMm
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeNav__Fit, Na__LeNav__PanBy, Na__LeNav__ZoomAbout } from '../10__Core__SheetSurface/Na__LayoutEditor__Navigation__.js';
    import { Na__LePc__Attach, Na__LePc__Detach } from '../10__Core__SheetSurface/Na__LayoutEditor__Controls__Pc__.js';
    import { Na__LeVwTouch__Attach, Na__LeVwTouch__Detach, Na__LeVwTouch__Stop } from './Na__LayoutEditor__WebViewer__TouchControls__.js';
    import { Na__DevGate__IsAuthoringEnabled } from '../../03__AppUtils/Na__AppUtils__DevGate__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | How Close to the Fit Zoom Still Counts as Fitted
    // ------------------------------------------------------------
    // A double tap toggles between the whole sheet and a magnified reading of
    // it, so it has to decide which of the two it is looking at. Exact equality
    // would fail after any rounding, and a wide tolerance would make a gently
    // pinched view read as fitted and jump away under the finger.
    // ------------------------------------------------------------
    const Na__LeVwDraw__FIT_TOLERANCE = 0.02;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | How Long an Eased Zoom Glides
    // ------------------------------------------------------------
    // Long enough for the eye to follow where the sheet went - the reason a
    // jump of x2.5 in one frame read as "massive chunks" - and short enough
    // that a button still feels like it answered at once. 180 ms with an
    // ease-out cubic: most of the change lands in the first 80 ms.
    // ------------------------------------------------------------
    const Na__LeVwDraw__EASE_MS = 180;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Attachment
    // ------------------------------------------------------------
    let Na__LeVwDraw__Attached = false;
    let Na__LeVwDraw__TapHandler = null;                                         // <-- Asked first about a finger's tap (the measuring tools); true means it used it
    let Na__LeVwDraw__Ease     = null;                                           // <-- A glide under way: { from, to, x, y, start, frame, done }
    let Na__LeVwDraw__Interrupt = null;                                          // <-- The listener that stops a glide when a finger, a button or the wheel takes over
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Zoom Readings
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Zoom the Whole Sheet Would Fit At
    // ------------------------------------------------------------
    // The same arithmetic Na__LeNav__Fit applies, without applying it: the fit
    // is needed as a READING here (is this view the whole sheet?) as well as an
    // action, and navigation only offers the action. Answers 0 when there is no
    // sheet or the stage has not been laid out yet, and every caller treats 0
    // as "no opinion" rather than as a zoom.
    // ------------------------------------------------------------
    function Na__LeVwDraw__FitZoom() {
        const els    = Na__LeSurface__GetElements();
        const layout = Na__LeSurface__GetLayout();
        if (!els.stage || !layout) return 0;
        const setup  = Na__LeCfg__GetNavigationSetup();
        const ppm    = Na__LeSurface__GetPixelsPerMm();
        const availW = els.stage.clientWidth  - (setup.fitPaddingPx * 2);
        const availH = els.stage.clientHeight - (setup.fitPaddingPx * 2);
        if (availW <= 0 || availH <= 0 || !ppm) return 0;
        return Math.min(availW / (layout.Page.WidthMm * ppm), availH / (layout.Page.HeightMm * ppm));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is the Whole Sheet on Screen Right Now
    // ------------------------------------------------------------
    function Na__LeVwDraw__IsFitted() {
        const fit = Na__LeVwDraw__FitZoom();
        if (!fit) return true;                                                   // <-- Nothing to compare against: treat it as fitted so a tap magnifies
        return Math.abs(Na__LeSurface__GetZoom() - fit) <= (fit * Na__LeVwDraw__FIT_TOLERANCE);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Eased Zoom
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Zoom Range a Glide May Aim Within
    // ------------------------------------------------------------
    // The same ceiling and floor Na__LeNav__ZoomAbout clamps every step to. The
    // glide needs them for its TARGET: presses stack on the target, and one
    // left free to run past the ceiling would make the next - press do nothing
    // while it worked its way back down.
    // ------------------------------------------------------------
    function Na__LeVwDraw__ClampZoom(zoom) {
        const setup = Na__LeCfg__GetNavigationSetup();
        const max   = (Na__DevGate__IsAuthoringEnabled() && Number.isFinite(setup.authoringZoomMax)) ? setup.authoringZoomMax : setup.zoomMax;
        return Math.min(max, Math.max(setup.zoomMin, zoom));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stop a Glide Where It Is
    // ------------------------------------------------------------
    // The zoom already reached stays; the surface settles it on its own timer
    // (every step was a gesture step), so nothing is left half drawn.
    // ------------------------------------------------------------
    function Na__LeVwDraw__StopEase() {
        if (Na__LeVwDraw__Ease && Na__LeVwDraw__Ease.frame) window.cancelAnimationFrame(Na__LeVwDraw__Ease.frame);
        Na__LeVwDraw__Ease = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Frame of a Glide
    // ------------------------------------------------------------
    // GEOMETRIC, NOT LINEAR: the zoom runs from -> to as a ratio, so a glide
    // out reads at the same pace as the glide in that it undoes. Every frame is
    // a gesture step (the fourth argument), so the sheet is scaled as the one
    // layer already drawn and painted crisp once, when the glide has rested.
    // ------------------------------------------------------------
    function Na__LeVwDraw__EaseStep(now) {
        const ease = Na__LeVwDraw__Ease;
        if (!ease) return;
        const t = Math.min(1, Math.max(0, (now - ease.start) / Na__LeVwDraw__EASE_MS));
        const k = 1 - Math.pow(1 - t, 3);                                        // <-- Ease-out cubic
        Na__LeNav__ZoomAbout(ease.from * Math.pow(ease.to / ease.from, k), ease.x, ease.y, true);
        if (t < 1) { ease.frame = window.requestAnimationFrame(Na__LeVwDraw__EaseStep); return; }
        Na__LeVwDraw__Ease = null;
        if (typeof ease.done === 'function') ease.done();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Glide the Zoom to a Target About a Client Point
    // ------------------------------------------------------------
    // A glide already running is replaced by one from where it has got to, so
    // a second press during the first carries on smoothly rather than jumping.
    // done() runs when the glide arrives, never when it is interrupted.
    // ------------------------------------------------------------
    function Na__LeVwDraw__EaseZoomAbout(target, clientX, clientY, done) {
        const from = Na__LeSurface__GetZoom();
        const to   = Na__LeVwDraw__ClampZoom(target);
        Na__LeVwDraw__StopEase();
        Na__LeVwTouch__Stop();                                                   // <-- A coasting sheet would fight the glide's anchor
        if (!(from > 0) || !(to > 0) || Math.abs(to - from) <= from * 1e-4) {
            if (typeof done === 'function') done();
            return;
        }
        Na__LeVwDraw__Ease = { from : from, to : to, x : clientX, y : clientY, start : performance.now(), frame : 0, done : done };
        Na__LeVwDraw__Ease.frame = window.requestAnimationFrame(Na__LeVwDraw__EaseStep);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Glide Back to the Whole Sheet
    // ------------------------------------------------------------
    // A zoom about a point keeps that point still, so a glide to Fit needs the
    // ONE point that the zoom maps from where the paper is now to where Fit
    // will centre it. For a scale s about a point p, a paper edge at L lands at
    // p + s(L - p); asking for Fit's edge F gives p = (F - sL) / (1 - s), on
    // each axis. Fit itself runs at the end to land the last pixel exactly.
    // A sheet already within the tolerance of Fit simply fits.
    // ------------------------------------------------------------
    function Na__LeVwDraw__EaseToFit() {
        const els  = Na__LeSurface__GetElements();
        const fit  = Na__LeVwDraw__FitZoom();
        const zoom = Na__LeSurface__GetZoom();
        if (!els.stage || !els.paper || !fit || !(zoom > 0)) { Na__LeVwDraw__StopEase(); Na__LeNav__Fit(); return; }
        const s = Na__LeVwDraw__ClampZoom(fit) / zoom;
        if (Math.abs(1 - s) < 0.01) { Na__LeVwDraw__StopEase(); Na__LeNav__Fit(); return; }
        const stageRect = els.stage.getBoundingClientRect();
        const paperRect = els.paper.getBoundingClientRect();
        const fitLeft = stageRect.left + els.stage.clientLeft + ((els.stage.clientWidth  - (paperRect.width  * s)) / 2);
        const fitTop  = stageRect.top  + els.stage.clientTop  + ((els.stage.clientHeight - (paperRect.height * s)) / 2);
        const px = (fitLeft - (s * paperRect.left)) / (1 - s);
        const py = (fitTop  - (s * paperRect.top))  / (1 - s);
        Na__LeVwDraw__EaseZoomAbout(fit, px, py, () => { if (Na__LeVwDraw__Attached) Na__LeNav__Fit(); });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Gesture Handlers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | How Far the Stage May Scroll Before the Paper Leaves the Screen
    // ------------------------------------------------------------
    // THE READER'S EDGE IS THE PAPER'S EDGE, NOT THE STAGE'S. The stage is much
    // larger than the sheet on purpose - the roaming room is where an author
    // drags an item off the paper and back - and on a phone a fitted A3 sheet
    // sits in about 300px of paper inside 1,000px of scrollable room. Left to
    // the browser's own clamp, a finger dragged sideways travels 340px of empty
    // grey before it has spent anything, so the swipe budget never builds and
    // the page never turns. A reader has no use for the room at all: the sheet
    // is the document.
    //
    // Answers { min, max } in scroll units, or null when the paper fits along
    // that axis, which means there is nothing to pan to and every pixel asked
    // for is spare. Scroll grows as the content travels the other way, so the
    // SMALLEST useful scroll is the one that puts the paper's near edge against
    // the stage's near edge, and the largest puts its far edge against the far
    // side. Getting those two the wrong way round does not merely fail to
    // clamp: it pins the sheet to one edge and every drag reads as spare.
    // ------------------------------------------------------------
    function Na__LeVwDraw__Range(stage, stageRect, paperRect, vertical) {
        const size = vertical ? paperRect.height : paperRect.width;
        const room = vertical ? stage.clientHeight : stage.clientWidth;
        if (size <= room) return null;                                           // <-- The whole sheet is on screen along this axis
        const scroll = vertical ? stage.scrollTop : stage.scrollLeft;
        const atNear = scroll + ((vertical ? paperRect.top : paperRect.left) - (vertical ? stageRect.top : stageRect.left));
        return { min : atNear, max : atNear + size - room };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pan the Stage Within the Paper, and Say How Much Landed
    // ------------------------------------------------------------
    // Clamped to the sheet rather than to the content: the stage is a whole
    // screen larger than the paper on every side so an author can push an item
    // off the page, and a reader dragged through all that empty grey before the
    // drawing moved at all.
    //
    // WHAT LANDED IS WORKED OUT, NOT READ BACK. Reading scrollLeft straight
    // after writing it forces the browser to lay the page out there and then,
    // and this runs inside a live gesture. It does not need to be read: the
    // clamp above is strictly inside the stage's own scroll range - the room
    // reaches a screen beyond the paper in both directions - so the position
    // asked for is always the position given.
    // ------------------------------------------------------------
    function Na__LeVwDraw__OnPan(dx, dy) {
        const els = Na__LeSurface__GetElements();
        if (!els.stage) return { x : 0, y : 0 };
        if (!els.paper) {                                                        // <-- No sheet laid out: let the stage scroll as it likes
            Na__LeNav__PanBy(dx, dy);
            return { x : dx, y : dy };
        }
        const stageRect = els.stage.getBoundingClientRect();                     // <-- One measure of each, for both axes
        const paperRect = els.paper.getBoundingClientRect();
        const across  = Na__LeVwDraw__Range(els.stage, stageRect, paperRect, false);
        const down    = Na__LeVwDraw__Range(els.stage, stageRect, paperRect, true);
        const beforeX = els.stage.scrollLeft;
        const beforeY = els.stage.scrollTop;
        const wantX = across ? Math.max(across.min, Math.min(across.max, beforeX + dx)) : beforeX;
        const wantY = down   ? Math.max(down.min,   Math.min(down.max,   beforeY + dy)) : beforeY;
        Na__LeNav__PanBy(wantX - beforeX, wantY - beforeY);
        return { x : wantX - beforeX, y : wantY - beforeY };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pinch: Multiply the Zoom About the Fingers' Midpoint
    // ------------------------------------------------------------
    // A GESTURE STEP (the fourth argument), as a wheel notch is: the sheet is
    // scaled as the layer already drawn while the fingers move, and laid out
    // and painted crisp once they rest. Without it every frame of a pinch
    // settled the zoom and redrew the whole sheet under the fingers.
    // ------------------------------------------------------------
    function Na__LeVwDraw__OnPinch(factor, clientX, clientY) {
        if (!Number.isFinite(factor) || factor <= 0) return;
        Na__LeVwDraw__StopEase();
        Na__LeNav__ZoomAbout(Na__LeSurface__GetZoom() * factor, clientX, clientY, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Double Tap: The Whole Sheet, or a Closer Look at That Point
    // ------------------------------------------------------------
    // Both ways glide (EASE_MS) rather than land in one frame.
    // ------------------------------------------------------------
    function Na__LeVwDraw__OnDoubleTap(clientX, clientY) {
        if (!Na__LeVwDraw__IsFitted()) { Na__LeVwDraw__EaseToFit(); return; }
        const setup = Na__LeCfg__GetWebViewerSetup();
        Na__LeVwDraw__EaseZoomAbout(Na__LeSurface__GetZoom() * setup.doubleTapZoomFactor, clientX, clientY);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Single Tap: Offered to the Tap Handler First
    // ------------------------------------------------------------
    // While a measuring tool is on, a tap puts a point down; the recogniser is
    // told it was used, so two quick taps are two points and never a double
    // tap zoom. A tap nobody uses is left to become one.
    // ------------------------------------------------------------
    function Na__LeVwDraw__OnTap(clientX, clientY) {
        if (!Na__LeVwDraw__TapHandler) return false;
        try { return Na__LeVwDraw__TapHandler(clientX, clientY) === true; }
        catch (error) { console.warn('[TrueVision3D] Viewer tap handler:', error); return false; }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Bind the Viewer's Input to the Sheet Stage
    // ------------------------------------------------------------
    // NO onSwipe, DELIBERATELY. One finger pans a drawing, and a sheet fitted
    // to the screen has no panning left to do - so every sideways drag would be
    // travel the sheet could not use, and the document would change under a
    // reader who was only trying to move the drawing about. Changing document
    // is the tab strip's and the dock's; the drawing keeps the finger.
    // ------------------------------------------------------------
    function Na__LeVwDraw__Attach() {
        if (Na__LeVwDraw__Attached) return true;
        const els = Na__LeSurface__GetElements();
        if (!els.stage) return false;
        Na__LeVwDraw__Attached = true;
        Na__LePc__Attach();                                                      // <-- Wheel zoom, drag pan and the navigation keys; no tools follow it
        Na__LeVwTouch__Attach(els.stage, {
            onPan       : Na__LeVwDraw__OnPan,
            onPinch     : Na__LeVwDraw__OnPinch,
            onTap       : Na__LeVwDraw__OnTap,
            onDoubleTap : Na__LeVwDraw__OnDoubleTap
        }, { inertia : true });
        // A FINGER, A MOUSE BUTTON OR THE WHEEL ON THE SHEET TAKES IT OVER: a
        // glide still running would fight the hand for the zoom. Capture and
        // passive, so this only listens and every other handler runs as before.
        Na__LeVwDraw__Interrupt = () => Na__LeVwDraw__StopEase();
        els.stage.addEventListener('pointerdown', Na__LeVwDraw__Interrupt, { capture : true, passive : true });
        els.stage.addEventListener('wheel',       Na__LeVwDraw__Interrupt, { capture : true, passive : true });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Who Is Offered a Finger's Single Tap First (null for nobody)
    // ------------------------------------------------------------
    // fn(clientX, clientY) answers true when it used the tap. Set once by the
    // web viewer for its measuring tools; kept across attach and detach.
    // ------------------------------------------------------------
    function Na__LeVwDraw__SetTapHandler(fn) {
        Na__LeVwDraw__TapHandler = (typeof fn === 'function') ? fn : null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Let the Stage Go
    // ------------------------------------------------------------
    function Na__LeVwDraw__Detach() {
        if (!Na__LeVwDraw__Attached) return false;
        Na__LeVwDraw__StopEase();
        const els = Na__LeSurface__GetElements();
        if (els.stage && Na__LeVwDraw__Interrupt) {
            els.stage.removeEventListener('pointerdown', Na__LeVwDraw__Interrupt, { capture : true });
            els.stage.removeEventListener('wheel',       Na__LeVwDraw__Interrupt, { capture : true });
        }
        Na__LeVwDraw__Interrupt = null;
        Na__LeVwTouch__Detach();
        Na__LePc__Detach();
        Na__LeVwDraw__Attached = false;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fit the Whole Sheet, Once the Stage Has a Size
    // ------------------------------------------------------------
    // NOW WHEN IT CAN BE, NEXT FRAME WHEN IT CANNOT. The fit is arithmetic on
    // the stage's measured box, so it only has to wait when the stage has not
    // been laid out yet - the first show, where it has just stopped being
    // hidden. Waiting unconditionally would be worse than a frame of latency:
    // requestAnimationFrame does not run at all while the page is not being
    // painted, so a Fit pressed in a background or occluded tab would simply
    // never happen, and the reader would come back to a sheet that had ignored
    // them.
    // ------------------------------------------------------------
    function Na__LeVwDraw__Fit() {
        Na__LeVwDraw__StopEase();
        Na__LeVwTouch__Stop();
        const els = Na__LeSurface__GetElements();
        if (els.stage && els.stage.clientWidth > 0 && els.stage.clientHeight > 0) { Na__LeNav__Fit(); return true; }
        window.requestAnimationFrame(() => { if (Na__LeVwDraw__Attached) Na__LeNav__Fit(); });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Glide to the Whole Sheet (the Dock's Fit Button)
    // ------------------------------------------------------------
    // The reader pressed Fit, so the sheet glides there and they can see where
    // they were on it. A document being shown for the first time uses Fit,
    // which lands at once: there is nowhere to glide from.
    // ------------------------------------------------------------
    function Na__LeVwDraw__FitEased() {
        const els = Na__LeSurface__GetElements();
        if (!els.stage || !(els.stage.clientWidth > 0) || !(els.stage.clientHeight > 0)) return Na__LeVwDraw__Fit();
        Na__LeVwDraw__EaseToFit();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Step the Zoom In or Out From the Dock Buttons
    // ------------------------------------------------------------
    // A GLIDE about the middle of the stage. A press during a glide multiplies
    // the glide's TARGET, not the zoom it has reached, so three quick presses
    // of 1.25 always come to 1.95 however fast they are made.
    // ------------------------------------------------------------
    function Na__LeVwDraw__ZoomBy(factor) {
        if (!Number.isFinite(factor) || factor <= 0) return false;
        const els = Na__LeSurface__GetElements();
        if (!els.stage) return false;
        const base = Na__LeVwDraw__Ease ? Na__LeVwDraw__Ease.to : Na__LeSurface__GetZoom();
        const rect = els.stage.getBoundingClientRect();
        Na__LeVwDraw__EaseZoomAbout(base * factor, rect.left + (rect.width / 2), rect.top + (rect.height / 2));
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Zoom as a Percentage, for the Dock to Show
    // ------------------------------------------------------------
    function Na__LeVwDraw__ZoomPercent() {
        return Math.round(Na__LeSurface__GetZoom() * 100);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Viewer Bound to the Stage
    // ------------------------------------------------------------
    function Na__LeVwDraw__IsAttached() { return Na__LeVwDraw__Attached; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Web Viewer Drawings API
    // ------------------------------------------------------------
    export {
        Na__LeVwDraw__Attach,
        Na__LeVwDraw__Detach,
        Na__LeVwDraw__SetTapHandler,
        Na__LeVwDraw__Fit,
        Na__LeVwDraw__FitEased,
        Na__LeVwDraw__ZoomBy,
        Na__LeVwDraw__ZoomPercent,
        Na__LeVwDraw__IsFitted,
        Na__LeVwDraw__IsAttached
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
