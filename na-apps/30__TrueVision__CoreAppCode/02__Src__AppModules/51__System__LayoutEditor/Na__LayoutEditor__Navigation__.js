// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - NAVIGATION
// =============================================================================
//
// FILE       : Na__LayoutEditor__Navigation__.js
// NAMESPACE  : Na__LeNav
// MODULE     : Layout Editor - Navigation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The maths that moves the sheet: zoom about a point, zoom to a level, fit, and pan
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - This module is the only place that decides where the sheet ends up. It
//   knows nothing about buttons, keys or fingers: the PC and touchscreen
//   control modules read the key map, work out what the user meant, and call
//   in here. That split is what lets a binding change in a JSON file without
//   any movement code being touched.
// - Zoom keeps the paper point under a client position exactly where it was,
//   which is what makes zooming into a corner of a sheet feel controlled. The
//   paper is transform scaled from its top left and the scaler is sized to the
//   scaled paper, so the stage's own scrollbars stay honest and panning is
//   nothing more than moving the stage's scroll position.
// - Fit computes the zoom that shows the whole paper inside the stage with a
//   padding, then centres it.
//
// INTEGRATION:
// - Na__LayoutEditor__Controls__Pc__ and Na__LayoutEditor__Controls__TouchScreen__
//   drive every function here from user input.
// - Na__LayoutEditor__ModeController__ calls Fit once the stage has a size.
// - Na__LayoutEditor__Toolbar__ calls Fit and ZoomTo from its buttons.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Navigation__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - Gesture handling lifted out into Na__LayoutEditor__Controls__Pc__ and
//   Na__LayoutEditor__Controls__TouchScreen__, so the bindings could move into
//   the key map data file. Attach and Detach are gone from this module; the
//   mode controller now attaches the two control modules instead.
// - PanBy added so both control modules move the sheet through one function.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and Surface
    // ------------------------------------------------------------
    import { Na__LeCfg__GetNavigationSetup } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeSurface__SetZoom,
        Na__LeSurface__GetZoom,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__GetLayout,
        Na__LeSurface__GetElements
    } from './Na__LayoutEditor__SheetSurface__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Zoom Maths
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Clamp a Zoom to the Configured Range
    // ------------------------------------------------------------
    function Na__LeNav__Clamp(zoom) {
        const setup = Na__LeCfg__GetNavigationSetup();
        return Math.min(setup.zoomMax, Math.max(setup.zoomMin, zoom));
    }
    // ------------------------------------------------------------


    // FUNCTION | Zoom So the Paper Point Under a Client Position Stays Put
    // ------------------------------------------------------------
    function Na__LeNav__ZoomAbout(newZoom, clientX, clientY) {
        const els = Na__LeSurface__GetElements();
        if (!els.stage || !els.paper) return;
        const before = Na__LeSurface__GetZoom();
        const after  = Na__LeNav__Clamp(newZoom);
        if (after === before) return;
        const stageRect = els.stage.getBoundingClientRect();
        const paperRect = els.paper.getBoundingClientRect();
        const ppm       = Na__LeSurface__GetPixelsPerMm();
        // The paper millimetre under the cursor, then where the paper's
        // top-left has to sit afterwards for that millimetre to stay there.
        const mmX = (clientX - paperRect.left) / (ppm * before);
        const mmY = (clientY - paperRect.top)  / (ppm * before);
        Na__LeSurface__SetZoom(after);
        const scalerLeft = els.scaler.offsetLeft;                                // <-- Includes the centring margin at the new size
        const scalerTop  = els.scaler.offsetTop;
        els.stage.scrollLeft = scalerLeft + (mmX * ppm * after) - (clientX - stageRect.left);
        els.stage.scrollTop  = scalerTop  + (mmY * ppm * after) - (clientY - stageRect.top);
    }
    // ------------------------------------------------------------


    // FUNCTION | Zoom About the Centre of the Stage
    // ------------------------------------------------------------
    function Na__LeNav__ZoomTo(newZoom) {
        const els = Na__LeSurface__GetElements();
        if (!els.stage) return;
        const rect = els.stage.getBoundingClientRect();
        Na__LeNav__ZoomAbout(newZoom, rect.left + (rect.width / 2), rect.top + (rect.height / 2));
    }
    // ------------------------------------------------------------


    // FUNCTION | Fit the Whole Paper Into the Stage
    // ------------------------------------------------------------
    function Na__LeNav__Fit() {
        const els    = Na__LeSurface__GetElements();
        const layout = Na__LeSurface__GetLayout();
        if (!els.stage || !layout) return;
        const setup   = Na__LeCfg__GetNavigationSetup();
        const ppm     = Na__LeSurface__GetPixelsPerMm();
        const availW  = els.stage.clientWidth  - (setup.fitPaddingPx * 2);
        const availH  = els.stage.clientHeight - (setup.fitPaddingPx * 2);
        if (availW <= 0 || availH <= 0) return;
        const zoom = Na__LeNav__Clamp(Math.min(availW / (layout.Page.WidthMm * ppm), availH / (layout.Page.HeightMm * ppm)));
        Na__LeSurface__SetZoom(zoom);
        els.stage.scrollLeft = Math.max(0, els.scaler.offsetLeft - ((els.stage.clientWidth  - els.scaler.offsetWidth)  / 2));
        els.stage.scrollTop  = Math.max(0, els.scaler.offsetTop  - ((els.stage.clientHeight - els.scaler.offsetHeight) / 2));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pan
// -----------------------------------------------------------------------------

    // FUNCTION | Move the View by a Number of Screen Pixels
    // ------------------------------------------------------------
    // Positive values move the view right and down, which is the same as the
    // content travelling left and up. A drag therefore passes the inverse of
    // the pointer delta, so the sheet stays under the finger or the cursor.
    // The browser clamps the scroll position for us, so an over-pan simply
    // stops at the edge of the stage.
    function Na__LeNav__PanBy(dxPx, dyPx) {
        const els = Na__LeSurface__GetElements();
        if (!els.stage) return;
        if (Number.isFinite(dxPx) && dxPx !== 0) els.stage.scrollLeft += dxPx;
        if (Number.isFinite(dyPx) && dyPx !== 0) els.stage.scrollTop  += dyPx;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Navigation API
    // ------------------------------------------------------------
    export {
        Na__LeNav__ZoomAbout,
        Na__LeNav__ZoomTo,
        Na__LeNav__Fit,
        Na__LeNav__PanBy
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
