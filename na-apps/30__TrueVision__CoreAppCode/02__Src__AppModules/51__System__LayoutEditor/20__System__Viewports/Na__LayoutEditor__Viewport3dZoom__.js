// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT 3D ZOOM
// =============================================================================
//
// FILE       : Na__LayoutEditor__Viewport3dZoom__.js
// NAMESPACE  : Na__LeVpZoom
// MODULE     : Layout Editor - Viewport 3D Zoom
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Zoom a 3D viewport's picture inside its frame - the wheel while its content is being edited, and the arithmetic behind the Viewport panel's Zoom box
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A 3D viewport's picture is its scene camera's frame laid on the paper at
//   Viewport__ImageMm, placed at Viewport__ImageOffsetMm inside the frame.
//   Viewport__ImageZoom multiplies that size. At 2 the picture is drawn twice
//   as large and the frame shows the middle of what the camera saw; at 0.5 it
//   is drawn half as large and the frame shows the camera's view with more of
//   the scene round it. The camera never moves, so the perspective is the
//   scene's own at every zoom - only the framing changes.
// - A zoom ABOUT A POINT scales the picture about that point, so whatever is
//   under the cursor stays under it: the offset scales by the same factor.
//   The Zoom box zooms about the middle of the frame.
// - Na__LayoutEditor__Viewport3d__ renders only what the frame shows of the
//   zoomed picture, at the frame's own resolution. A picture zoomed in stays
//   sharp, and one zoomed out fills its frame rather than floating in it.
//
// THE WHEEL:
// - Only while a 3D viewport's content is being edited (double-click it, or
//   Edit viewport content on its right-click menu), and only over its frame.
//   Anywhere else the wheel zooms the sheet, as it always has.
// - Shift zooms in fine steps (ImageZoomFineFactor of a normal one). Chrome
//   turns Shift+wheel into a sideways scroll, so the sideways delta stands in
//   when the vertical one is empty.
// - Every notch patches the record silently and redraws the frame at once;
//   the change is announced when the wheel has rested for ImageZoomCommitMs,
//   so a run of notches is ONE undo step. A key or a press in the meantime
//   announces it straight away, so Ctrl+Z just after zooming undoes the zoom
//   and nothing before it.
// - Enter finishes editing the content (Na__LayoutEditor__SheetTools__), and
//   the picture stays at the zoom it was left at.
//
// INTEGRATION:
// - Na__LayoutEditor__Controls__Pc__ offers every stage wheel event to OnWheel
//   before the sheet's own zoom.
// - Na__LayoutEditor__Panel__ViewportSettings__ shows Get as a percentage and
//   writes PatchAbout and PatchReset; Na__LayoutEditor__SheetTools__ recentres
//   a 3D picture through CentredOffset.
// - Na__LayoutEditor__SheetRecords__ clamps the stored value to
//   LayoutEditor__Viewport__ImageZoomMin and ImageZoomMax, and keeps it only
//   when it is not 1.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported to      : ValeVision3D 51__System__LayoutEditor (pending Adam's sign-off)
// - Parity         : authored in TrueVision first
// - Divergences    : none expected - the viewport record is shared field for field
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.0.0
// - First cut. The wheel zooms an edited 3D viewport's picture about the
//   cursor, Shift in fine steps, one undo step per run of notches. PatchAbout,
//   PatchReset and CentredOffset for the Viewport panel's Zoom box and for
//   Recentre content.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model and Surface
    // ------------------------------------------------------------
    import { Na__LeCfg__GetViewportSetup, Na__LeCfg__GetNavigationSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__KIND_3D,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetViewportById,
        Na__LeModel__UpdateViewport,
        Na__LeModel__IsLayerLocked
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__GetEditingViewport, Na__LeSurface__ClientToPaperMm, Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Wheel Units and the Keys That Never Interrupt a Run
    // ------------------------------------------------------------
    const Na__LeVpZoom__LINE_HEIGHT_PX = 20;                                     // <-- deltaMode 1 reports lines, not pixels (read as the PC controls read it)
    const Na__LeVpZoom__MODIFIER_KEYS  = [ 'Shift', 'Control', 'Alt', 'Meta' ];  // <-- Held for fine steps, and Windows repeats a held key
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Run of Notches Waiting to Be Announced
    // ------------------------------------------------------------
    let Na__LeVpZoom__Pending   = null;    // <-- { sheetId, viewportId, timer }
    let Na__LeVpZoom__Listening = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Arithmetic
// -----------------------------------------------------------------------------

    // FUNCTION | The Zoom a Viewport's Picture Is Drawn At (1 when it was never zoomed)
    // ------------------------------------------------------------
    function Na__LeVpZoom__Get(viewport) {
        const zoom = viewport ? viewport.Viewport__ImageZoom : null;
        return (typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0) ? zoom : 1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Zoom Held Inside the Configured Limits
    // ------------------------------------------------------------
    function Na__LeVpZoom__Clamp(zoom) {
        const setup = Na__LeCfg__GetViewportSetup();
        return Math.min(setup.imageZoomMax, Math.max(setup.imageZoomMin, zoom));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Patch That Zooms a Picture About a Point of Its Frame
    // ------------------------------------------------------------
    // zoom     : the zoom wanted; held inside the configured limits
    // anchorMm : { x, y } in millimetres from the frame's top-left corner, or
    //            null for the middle of the frame
    // Returns { imageZoom, imageOffset } for Na__LeModel__UpdateViewport, or
    // null for a zoom that is not a number.
    // ------------------------------------------------------------
    function Na__LeVpZoom__PatchAbout(viewport, zoom, anchorMm) {
        if (!viewport || typeof zoom !== 'number' || !Number.isFinite(zoom) || zoom <= 0) return null;
        const next   = Na__LeVpZoom__Clamp(zoom);
        const factor = next / Na__LeVpZoom__Get(viewport);
        const frame  = viewport.Viewport__FrameMm;
        const offset = viewport.Viewport__ImageOffsetMm;
        const anchor = anchorMm || { x : frame.WidthMm / 2, y : frame.HeightMm / 2 };
        return {
            imageZoom   : next,
            imageOffset : { X : anchor.x + ((offset.X - anchor.x) * factor), Y : anchor.y + ((offset.Y - anchor.y) * factor) }   // <-- The anchor is the one point that does not move
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Offset That Centres a Picture in Its Frame
    // ------------------------------------------------------------
    // zoom: the zoom to centre at, or omitted for the zoom it is drawn at. A
    // viewport never zoomed or cropped centres at 0, 0 - where it started.
    // ------------------------------------------------------------
    function Na__LeVpZoom__CentredOffset(viewport, zoom) {
        const z     = (typeof zoom === 'number' && Number.isFinite(zoom) && zoom > 0) ? zoom : Na__LeVpZoom__Get(viewport);
        const frame = viewport.Viewport__FrameMm;
        const image = viewport.Viewport__ImageMm;
        return { X : (frame.WidthMm - (image.WidthMm * z)) / 2, Y : (frame.HeightMm - (image.HeightMm * z)) / 2 };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Patch That Puts a Picture Back to 100 Percent, Centred
    // ------------------------------------------------------------
    function Na__LeVpZoom__PatchReset(viewport) {
        return viewport ? { imageZoom : 1, imageOffset : Na__LeVpZoom__CentredOffset(viewport, 1) } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Zoom as the Percentage the Panel Shows (one decimal place)
    // ------------------------------------------------------------
    function Na__LeVpZoom__Percent(zoom) {
        return Math.round(zoom * 1000) / 10;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Wheel
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Key or a Press Before the Wheel Rested: Announce the Run Now
    // ------------------------------------------------------------
    function Na__LeVpZoom__OnInterrupt(event) {
        if (event && event.type === 'keydown' && Na__LeVpZoom__MODIFIER_KEYS.indexOf(event.key) !== -1) return;
        Na__LeVpZoom__Commit();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Listen for Interruptions Only While a Run Is Waiting
    // ------------------------------------------------------------
    // In the capture phase, so the run is announced before whatever the key or
    // the press goes on to do - an undo, a click on another viewport, a change
    // of sheet.
    // ------------------------------------------------------------
    function Na__LeVpZoom__Listen(on) {
        const next = on === true;
        if (next === Na__LeVpZoom__Listening) return;
        Na__LeVpZoom__Listening = next;
        [ 'keydown', 'pointerdown' ].forEach((type) => {
            if (next) window.addEventListener(type, Na__LeVpZoom__OnInterrupt, true);
            else      window.removeEventListener(type, Na__LeVpZoom__OnInterrupt, true);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Book the Announcement for When the Wheel Rests
    // ------------------------------------------------------------
    function Na__LeVpZoom__Book(sheetId, viewportId) {
        const held = Na__LeVpZoom__Pending;
        if (held && (held.sheetId !== sheetId || held.viewportId !== viewportId)) Na__LeVpZoom__Commit();   // <-- Another viewport's run finishes first
        if (Na__LeVpZoom__Pending) window.clearTimeout(Na__LeVpZoom__Pending.timer);
        const delay = Na__LeCfg__GetViewportSetup().imageZoomCommitMs;
        Na__LeVpZoom__Pending = { sheetId : sheetId, viewportId : viewportId, timer : window.setTimeout(() => { Na__LeVpZoom__Commit(); }, delay) };
        Na__LeVpZoom__Listen(true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Announce a Waiting Run of Notches Now (one undo step)
    // ------------------------------------------------------------
    // Returns true when there was a run to announce.
    // ------------------------------------------------------------
    function Na__LeVpZoom__Commit() {
        const held = Na__LeVpZoom__Pending;
        if (!held) return false;
        window.clearTimeout(held.timer);
        Na__LeVpZoom__Pending = null;
        Na__LeVpZoom__Listen(false);
        const sheet = Na__LeModel__GetSheetById(held.sheetId);
        if (!sheet || !Na__LeModel__GetViewportById(sheet, held.viewportId)) return false;   // <-- The sheet or the viewport went while the wheel rested
        return Na__LeModel__UpdateViewport(sheet, held.viewportId, {}, false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Offer a Wheel Event to the 3D Viewport Being Edited
    // ------------------------------------------------------------
    // Returns true when the wheel was this module's: it was over the frame of a
    // 3D viewport whose content is being edited. Anything else returns false
    // and the sheet zooms as usual.
    // ------------------------------------------------------------
    function Na__LeVpZoom__OnWheel(event) {
        const viewportId = Na__LeSurface__GetEditingViewport();
        if (!event || !viewportId) return false;
        const sheet    = Na__LeModel__GetActiveSheet();
        const viewport = sheet ? Na__LeModel__GetViewportById(sheet, viewportId) : null;
        if (!viewport || viewport.Viewport__Kind !== Na__LeModel__KIND_3D) return false;   // <-- A 2D viewport's size on the paper is its scale
        if (viewport.Viewport__Locked === true || Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId)) return false;
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        const frame = viewport.Viewport__FrameMm;
        if (!point || point.x < frame.X || point.x > frame.X + frame.WidthMm || point.y < frame.Y || point.y > frame.Y + frame.HeightMm) return false;
        event.preventDefault();                                                  // <-- Over the frame the wheel is the picture's, even at a limit
        const raw = event.deltaY !== 0 ? event.deltaY : (event.shiftKey ? event.deltaX : 0);   // <-- Chrome sends Shift+wheel sideways
        if (!raw) return true;
        const setup   = Na__LeCfg__GetViewportSetup();
        const step    = Na__LeCfg__GetNavigationSetup().zoomWheelStep * (event.shiftKey ? setup.imageZoomFineFactor : 1);
        const lines   = (event.deltaMode === 1) ? Na__LeVpZoom__LINE_HEIGHT_PX : 1;
        const current = Na__LeVpZoom__Get(viewport);
        const patch   = Na__LeVpZoom__PatchAbout(viewport, current * Math.exp(-raw * lines * step), { x : point.x - frame.X, y : point.y - frame.Y });
        if (!patch || patch.imageZoom === current) return true;                  // <-- Already at the limit that way
        Na__LeModel__UpdateViewport(sheet, viewportId, patch, true);
        Na__LeSurface__Refresh('frames');                                        // <-- The picture held scales at once; the sharp render follows when the wheel rests
        Na__LeVpZoom__Book(sheet.Sheet__Id, viewportId);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport 3D Zoom API
    // ------------------------------------------------------------
    export {
        Na__LeVpZoom__Get,
        Na__LeVpZoom__PatchAbout,
        Na__LeVpZoom__PatchReset,
        Na__LeVpZoom__CentredOffset,
        Na__LeVpZoom__Percent,
        Na__LeVpZoom__OnWheel,
        Na__LeVpZoom__Commit
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
