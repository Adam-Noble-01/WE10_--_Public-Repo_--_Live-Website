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
// - A drag that runs out of paper turns the page. The touch recogniser needs to
//   know how much of a pan the stage could actually use, so the pan handler
//   measures the scroll before and after rather than assuming it all landed.
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
    import { Na__LeNav__Fit, Na__LeNav__PanBy, Na__LeNav__ZoomAbout, Na__LeNav__ZoomTo } from '../10__Core__SheetSurface/Na__LayoutEditor__Navigation__.js';
    import { Na__LePc__Attach, Na__LePc__Detach } from '../10__Core__SheetSurface/Na__LayoutEditor__Controls__Pc__.js';
    import { Na__LeVwTouch__Attach, Na__LeVwTouch__Detach } from './Na__LayoutEditor__WebViewer__TouchControls__.js';
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

    // MODULE VARIABLES | Attachment and the Zoom a Double Tap Returns To
    // ------------------------------------------------------------
    let Na__LeVwDraw__Attached = false;
    let Na__LeVwDraw__OnSwipe  = null;
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
    function Na__LeVwDraw__Range(stage, paper, vertical) {
        const stageRect = stage.getBoundingClientRect();
        const paperRect = paper.getBoundingClientRect();
        const size      = vertical ? paperRect.height : paperRect.width;
        const room      = vertical ? stage.clientHeight : stage.clientWidth;
        if (size <= room) return null;                                           // <-- The whole sheet is on screen along this axis
        const scroll  = vertical ? stage.scrollTop : stage.scrollLeft;
        const atNear  = scroll + ((vertical ? paperRect.top : paperRect.left) - (vertical ? stageRect.top : stageRect.left));
        return { min : atNear, max : atNear + size - room };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pan the Stage Within the Paper, and Say How Much Landed
    // ------------------------------------------------------------
    // Measured rather than assumed, and clamped to the sheet rather than to the
    // content. What the sheet could not take is what the recogniser turns into
    // a page change, so a fitted drawing - which can take nothing sideways -
    // turns the page on the first proper flick, and a magnified one pans to its
    // edge first and turns on the drag that carries past it.
    // ------------------------------------------------------------
    function Na__LeVwDraw__OnPan(dx, dy) {
        const els = Na__LeSurface__GetElements();
        if (!els.stage) return { x : 0, y : 0 };
        if (!els.paper) {                                                        // <-- No sheet laid out: let the stage scroll as it likes
            const wasX = els.stage.scrollLeft, wasY = els.stage.scrollTop;
            Na__LeNav__PanBy(dx, dy);
            return { x : els.stage.scrollLeft - wasX, y : els.stage.scrollTop - wasY };
        }
        const across = Na__LeVwDraw__Range(els.stage, els.paper, false);
        const down   = Na__LeVwDraw__Range(els.stage, els.paper, true);
        const beforeX = els.stage.scrollLeft;
        const beforeY = els.stage.scrollTop;
        const wantX = across ? Math.max(across.min, Math.min(across.max, beforeX + dx)) : beforeX;
        const wantY = down   ? Math.max(down.min,   Math.min(down.max,   beforeY + dy)) : beforeY;
        Na__LeNav__PanBy(wantX - beforeX, wantY - beforeY);
        return { x : els.stage.scrollLeft - beforeX, y : els.stage.scrollTop - beforeY };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pinch: Multiply the Zoom About the Fingers' Midpoint
    // ------------------------------------------------------------
    function Na__LeVwDraw__OnPinch(factor, clientX, clientY) {
        if (!Number.isFinite(factor) || factor <= 0) return;
        Na__LeNav__ZoomAbout(Na__LeSurface__GetZoom() * factor, clientX, clientY);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Double Tap: The Whole Sheet, or a Closer Look at That Point
    // ------------------------------------------------------------
    function Na__LeVwDraw__OnDoubleTap(clientX, clientY) {
        if (!Na__LeVwDraw__IsFitted()) { Na__LeNav__Fit(); return; }
        const setup = Na__LeCfg__GetWebViewerSetup();
        Na__LeNav__ZoomAbout(Na__LeSurface__GetZoom() * setup.doubleTapZoomFactor, clientX, clientY);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Bind the Viewer's Input to the Sheet Stage
    // ------------------------------------------------------------
    // options: { onSwipe(direction) }
    // ------------------------------------------------------------
    function Na__LeVwDraw__Attach(options) {
        if (Na__LeVwDraw__Attached) return true;
        const els = Na__LeSurface__GetElements();
        if (!els.stage) return false;
        Na__LeVwDraw__OnSwipe  = (options && typeof options.onSwipe === 'function') ? options.onSwipe : null;
        Na__LeVwDraw__Attached = true;
        Na__LePc__Attach();                                                      // <-- Wheel zoom, drag pan and the navigation keys; no tools follow it
        Na__LeVwTouch__Attach(els.stage, {
            onPan       : Na__LeVwDraw__OnPan,
            onPinch     : Na__LeVwDraw__OnPinch,
            onDoubleTap : Na__LeVwDraw__OnDoubleTap,
            onSwipe     : (direction) => { if (Na__LeVwDraw__OnSwipe) Na__LeVwDraw__OnSwipe(direction); }
        });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Let the Stage Go
    // ------------------------------------------------------------
    function Na__LeVwDraw__Detach() {
        if (!Na__LeVwDraw__Attached) return false;
        Na__LeVwTouch__Detach();
        Na__LePc__Detach();
        Na__LeVwDraw__Attached = false;
        Na__LeVwDraw__OnSwipe  = null;
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
        const els = Na__LeSurface__GetElements();
        if (els.stage && els.stage.clientWidth > 0 && els.stage.clientHeight > 0) { Na__LeNav__Fit(); return true; }
        window.requestAnimationFrame(() => { if (Na__LeVwDraw__Attached) Na__LeNav__Fit(); });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Step the Zoom In or Out From the Dock Buttons
    // ------------------------------------------------------------
    function Na__LeVwDraw__ZoomBy(factor) {
        if (!Number.isFinite(factor) || factor <= 0) return false;
        Na__LeNav__ZoomTo(Na__LeSurface__GetZoom() * factor);
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
        Na__LeVwDraw__Fit,
        Na__LeVwDraw__ZoomBy,
        Na__LeVwDraw__ZoomPercent,
        Na__LeVwDraw__IsFitted,
        Na__LeVwDraw__IsAttached
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
