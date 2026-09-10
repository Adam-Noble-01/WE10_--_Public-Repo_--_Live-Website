// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET SURFACE
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetSurface__.js
// NAMESPACE  : Na__LeSurface
// MODULE     : Layout Editor - Sheet Surface
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The paper on screen: frames, chrome, markup and selection, sized in true paper pixels
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The stage is a grey scrolling area. Inside it a scaler box the size of
//   the zoomed paper holds the paper element, which is laid out at
//   ScreenPixelsPerMm and scaled with a CSS transform. Everything on the
//   paper is placed in paper millimetres times that constant, so a zoom
//   never re-lays anything out.
// - Layers on the paper, bottom to top: viewport frames (one clipped box
//   each, filled by the 2D and 3D viewport modules), the chrome SVG (border,
//   title block, frame captions), the sheet markup SVG (annotations and
//   dimensions as primitives), and the selection layer (outline and handles,
//   drawn by the handles module and counter-scaled so they stay the same
//   size at any zoom).
// - The surface never listens to pointer events itself; the sheet tools own
//   the interaction and ask it for millimetres.
//
// INTEGRATION:
// - Mounted by the mode controller; refreshed on sheet model changes.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__SheetSurface__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.2.0
// - Grips for a selected dimension or shape in the handles layer.
//
// 10-Sep-2026 - Version 1.1.0
// - Editing and locked outline states; a full stage of margin on every side so the paper roams freely.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Layout, Model, Chrome, Markup, Viewports and Handles
    // ------------------------------------------------------------
    import { Na__LeLayout__Solve } from './Na__LayoutEditor__SheetLayout__.js';
    import {
        Na__LeModel__KIND_3D,
        Na__LeModel__GetLayers,
        Na__LeModel__GetFields,
        Na__LeModel__GetSelection,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked
    } from './Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeChrome__ASSET_EVENT,
        Na__LeChrome__Build,
        Na__LeChrome__ToSvgMarkup
    } from './Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeMarkup__BuildSheetPrimitives } from './Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeVp2d__Fill, Na__LeVp2d__Release } from './Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeVp3d__Fill, Na__LeVp3d__Release } from './Na__LayoutEditor__Viewport3d__.js';
    import { Na__LeHandles__Render, Na__LeHandles__Clear } from './Na__LayoutEditor__ViewportHandles__.js';
    import { Na__LeGrips__Render } from './Na__LayoutEditor__Grips__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Class Names and Events
    // ------------------------------------------------------------
    const Na__LeSurface__ZOOM_EVENT   = 'na-layouteditor-zoom-changed';
    const Na__LeSurface__CLASS_ROOM   = 'na-le-room';
    const Na__LeSurface__CLASS_SCALER = 'na-le-scaler';
    const Na__LeSurface__CLASS_PAPER  = 'na-le-paper';
    const Na__LeSurface__CLASS_FRAME  = 'na-le-frame';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Elements and Current Sheet
    // ------------------------------------------------------------
    let Na__LeSurface__Stage     = null;
    let Na__LeSurface__Room      = null;    // <-- Paper plus a whole stage of room on every side
    let Na__LeSurface__Scaler    = null;
    let Na__LeSurface__Paper     = null;
    let Na__LeSurface__Frames    = null;    // <-- Container of viewport frames
    let Na__LeSurface__ChromeSvg = null;
    let Na__LeSurface__MarkupSvg = null;
    let Na__LeSurface__Handles   = null;
    let Na__LeSurface__Sheet     = null;
    let Na__LeSurface__Layout    = null;
    let Na__LeSurface__Zoom      = 1;
    let Na__LeSurface__Ppm       = 3.2;     // <-- Screen pixels per paper millimetre at zoom 1
    let Na__LeSurface__Editable  = false;
    let Na__LeSurface__EditingId = null;    // <-- Viewport whose content is being repositioned (double-click)
    let Na__LeSurface__OnAsset   = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mount and Teardown
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build an Element With a Class
    // ------------------------------------------------------------
    function Na__LeSurface__El(tagName, className, parent) {
        const el = document.createElement(tagName);
        el.className = className;
        if (parent) parent.appendChild(el);
        return el;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Paper Inside a Stage Element
    // ------------------------------------------------------------
    function Na__LeSurface__Mount(stageElement, options) {
        if (!stageElement) return false;
        Na__LeSurface__Unmount();
        Na__LeSurface__Stage    = stageElement;
        Na__LeSurface__Editable = !!(options && options.editable);
        Na__LeSurface__Room     = Na__LeSurface__El('div', Na__LeSurface__CLASS_ROOM, stageElement);
        Na__LeSurface__Scaler   = Na__LeSurface__El('div', Na__LeSurface__CLASS_SCALER, Na__LeSurface__Room);
        Na__LeSurface__Paper    = Na__LeSurface__El('div', Na__LeSurface__CLASS_PAPER, Na__LeSurface__Scaler);
        Na__LeSurface__Frames   = Na__LeSurface__El('div', 'na-le-paper__viewports', Na__LeSurface__Paper);
        Na__LeSurface__Handles  = null;                                          // <-- Created after the SVG layers so it sits on top
        Na__LeSurface__OnAsset  = () => Na__LeSurface__RefreshChrome();
        window.addEventListener(Na__LeChrome__ASSET_EVENT, Na__LeSurface__OnAsset);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Paper and Forget the Sheet
    // ------------------------------------------------------------
    function Na__LeSurface__Unmount() {
        if (Na__LeSurface__OnAsset) window.removeEventListener(Na__LeChrome__ASSET_EVENT, Na__LeSurface__OnAsset);
        Na__LeSurface__OnAsset = null;
        if (Na__LeSurface__Sheet) Na__LeSurface__ReleaseFrames();
        if (Na__LeSurface__Room && Na__LeSurface__Room.parentNode) Na__LeSurface__Room.parentNode.removeChild(Na__LeSurface__Room);
        Na__LeSurface__Stage = Na__LeSurface__Room = Na__LeSurface__Scaler = Na__LeSurface__Paper = Na__LeSurface__Frames = null;
        Na__LeSurface__ChromeSvg = Na__LeSurface__MarkupSvg = Na__LeSurface__Handles = null;
        Na__LeSurface__Sheet = Na__LeSurface__Layout = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Let the Viewport Modules Drop Their Per-Frame State
    // ------------------------------------------------------------
    function Na__LeSurface__ReleaseFrames() {
        if (!Na__LeSurface__Frames) return;
        Array.from(Na__LeSurface__Frames.children).forEach((frame) => {
            const id = frame.getAttribute('data-na-viewport-id');
            if (frame.classList.contains(Na__LeSurface__CLASS_FRAME + '--3d')) Na__LeVp3d__Release(id); else Na__LeVp2d__Release(id);
        });
        Na__LeSurface__Frames.innerHTML = '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sheet and Paper
// -----------------------------------------------------------------------------

    // FUNCTION | Show a Sheet (full rebuild)
    // ------------------------------------------------------------
    function Na__LeSurface__SetSheet(sheet) {
        if (!Na__LeSurface__Paper) return false;
        if (Na__LeSurface__Sheet && (!sheet || sheet.Sheet__Id !== Na__LeSurface__Sheet.Sheet__Id)) Na__LeSurface__ReleaseFrames();
        Na__LeSurface__Sheet  = sheet || null;
        Na__LeSurface__Layout = sheet ? Na__LeLayout__Solve(sheet) : null;
        Na__LeSurface__Paper.hidden = !sheet;
        if (!sheet) return true;
        Na__LeSurface__Ppm = Na__LeSurface__Layout.ScreenPixelsPerMm;
        Na__LeSurface__Paper.style.width  = (Na__LeSurface__Layout.Page.WidthMm  * Na__LeSurface__Ppm) + 'px';
        Na__LeSurface__Paper.style.height = (Na__LeSurface__Layout.Page.HeightMm * Na__LeSurface__Ppm) + 'px';
        Na__LeSurface__ApplyZoom();
        Na__LeSurface__RefreshFrames();
        Na__LeSurface__RefreshChrome();
        Na__LeSurface__RefreshMarkup();
        Na__LeSurface__RefreshSelection();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Refresh Part of the Paper After a Model Change
    // ------------------------------------------------------------
    // reason: 'frames' | 'chrome' | 'markup' | 'selection' | 'all'
    // ------------------------------------------------------------
    function Na__LeSurface__Refresh(reason) {
        if (!Na__LeSurface__Sheet) return;
        const all = !reason || reason === 'all';
        if (all || reason === 'sheet') { Na__LeSurface__Layout = Na__LeLayout__Solve(Na__LeSurface__Sheet); Na__LeSurface__SetSheet(Na__LeSurface__Sheet); return; }
        if (all || reason === 'frames')    Na__LeSurface__RefreshFrames();
        if (all || reason === 'frames' || reason === 'chrome') Na__LeSurface__RefreshChrome();
        if (all || reason === 'markup')    Na__LeSurface__RefreshMarkup();
        if (all || reason === 'frames' || reason === 'markup' || reason === 'selection') Na__LeSurface__RefreshSelection();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply the Zoom to the Paper and Size the Scaler
    // ------------------------------------------------------------
    function Na__LeSurface__ApplyZoom() {
        if (!Na__LeSurface__Paper || !Na__LeSurface__Layout) return;
        const widthPx  = Na__LeSurface__Layout.Page.WidthMm  * Na__LeSurface__Ppm * Na__LeSurface__Zoom;
        const heightPx = Na__LeSurface__Layout.Page.HeightMm * Na__LeSurface__Ppm * Na__LeSurface__Zoom;
        Na__LeSurface__Paper.style.transform = 'scale(' + Na__LeSurface__Zoom + ')';
        Na__LeSurface__Scaler.style.width    = widthPx  + 'px';
        Na__LeSurface__Scaler.style.height   = heightPx + 'px';
        // ROOM TO ROAM | The paper sits a whole stage in from every edge of an
        // explicitly sized room, so it can be pushed clear of the window in any
        // direction the way a LayOut page can; Fit centres it by scrolling into
        // that room. Explicit sizes, because a scroll container does not
        // reliably count an end margin as scrollable.
        const stageW = Math.min(Na__LeSurface__Stage.clientWidth,  window.innerWidth);    // <-- The visible box, so a stage that ever grew with its content cannot feed back
        const stageH = Math.min(Na__LeSurface__Stage.clientHeight, window.innerHeight);
        Na__LeSurface__Room.style.width    = (widthPx  + (stageW * 2)) + 'px';
        Na__LeSurface__Room.style.height   = (heightPx + (stageH * 2)) + 'px';
        Na__LeSurface__Scaler.style.left   = stageW + 'px';
        Na__LeSurface__Scaler.style.top    = stageH + 'px';
        if (Na__LeSurface__Handles) Na__LeSurface__RefreshSelection();          // <-- Handles are counter-scaled
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Zoom (the navigation module keeps the cursor point fixed)
    // ------------------------------------------------------------
    function Na__LeSurface__SetZoom(zoom) {
        if (!Number.isFinite(zoom) || zoom <= 0) return Na__LeSurface__Zoom;
        Na__LeSurface__Zoom = zoom;
        Na__LeSurface__ApplyZoom();
        window.dispatchEvent(new CustomEvent(Na__LeSurface__ZOOM_EVENT, { detail : { zoom : zoom } }));
        return Na__LeSurface__Zoom;
    }
    function Na__LeSurface__GetZoom() { return Na__LeSurface__Zoom; }
    // ------------------------------------------------------------


    // FUNCTION | Screen Pixels per Paper Millimetre at Zoom 1
    // ------------------------------------------------------------
    function Na__LeSurface__GetPixelsPerMm() { return Na__LeSurface__Ppm; }
    // ------------------------------------------------------------


    // FUNCTION | Client Pixel to Paper Millimetre and Back
    // ------------------------------------------------------------
    function Na__LeSurface__ClientToPaperMm(clientX, clientY) {
        if (!Na__LeSurface__Paper) return null;
        const rect  = Na__LeSurface__Paper.getBoundingClientRect();
        const scale = Na__LeSurface__Ppm * Na__LeSurface__Zoom;
        return { x : (clientX - rect.left) / scale, y : (clientY - rect.top) / scale };
    }
    function Na__LeSurface__PaperMmToClient(xMm, yMm) {
        if (!Na__LeSurface__Paper) return null;
        const rect  = Na__LeSurface__Paper.getBoundingClientRect();
        const scale = Na__LeSurface__Ppm * Na__LeSurface__Zoom;
        return { x : rect.left + (xMm * scale), y : rect.top + (yMm * scale) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Accessors
    // ------------------------------------------------------------
    function Na__LeSurface__SetEditingViewport(viewportId) { Na__LeSurface__EditingId = viewportId || null; Na__LeSurface__RefreshSelection(); }
    function Na__LeSurface__GetEditingViewport() { return Na__LeSurface__EditingId; }
    function Na__LeSurface__GetSheet()  { return Na__LeSurface__Sheet; }
    function Na__LeSurface__GetLayout() { return Na__LeSurface__Layout; }
    function Na__LeSurface__GetElements() {
        return { stage : Na__LeSurface__Stage, scaler : Na__LeSurface__Scaler, paper : Na__LeSurface__Paper, frames : Na__LeSurface__Frames, handles : Na__LeSurface__Handles };
    }
    function Na__LeSurface__GetFrameBody(viewportId) {
        const frame = Na__LeSurface__Frames ? Na__LeSurface__Frames.querySelector('[data-na-viewport-id="' + viewportId + '"]') : null;
        return frame ? frame.firstElementChild : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Frame Z Order: the Top of the Layer List Draws Frontmost
    // ------------------------------------------------------------
    function Na__LeSurface__LayerRank(sheet, layerId) {
        const layers = Na__LeModel__GetLayers(sheet);
        const index  = layers.findIndex((layer) => layer.Layer__Id === layerId);
        return index < 0 ? 0 : (layers.length - index);
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild or Reposition Every Viewport Frame
    // ------------------------------------------------------------
    // Frames are reused across refreshes so the viewport modules can keep
    // their rendered content; a frame whose viewport is gone is released.
    // ------------------------------------------------------------
    function Na__LeSurface__RefreshFrames() {
        const sheet = Na__LeSurface__Sheet;
        if (!sheet || !Na__LeSurface__Frames) return;
        const ppm   = Na__LeSurface__Ppm;
        const alive = new Set();

        sheet.Sheet__Viewports.forEach((viewport) => {
            const id   = viewport.Viewport__Id;
            const is3d = viewport.Viewport__Kind === Na__LeModel__KIND_3D;
            alive.add(id);
            let frame = Na__LeSurface__Frames.querySelector('[data-na-viewport-id="' + id + '"]');
            if (frame && frame.classList.contains(Na__LeSurface__CLASS_FRAME + '--3d') !== is3d) { frame.remove(); frame = null; }
            if (!frame) {
                frame = Na__LeSurface__El('div', Na__LeSurface__CLASS_FRAME + ' ' + Na__LeSurface__CLASS_FRAME + (is3d ? '--3d' : '--2d'), Na__LeSurface__Frames);
                frame.setAttribute('data-na-viewport-id', id);
                Na__LeSurface__El('div', 'na-le-frame__body', frame);
            }
            const rect = viewport.Viewport__FrameMm;
            frame.style.left   = (rect.X * ppm) + 'px';
            frame.style.top    = (rect.Y * ppm) + 'px';
            frame.style.width  = (rect.WidthMm  * ppm) + 'px';
            frame.style.height = (rect.HeightMm * ppm) + 'px';
            frame.style.zIndex = String(Na__LeSurface__LayerRank(sheet, viewport.Viewport__LayerId));
            frame.hidden = !Na__LeModel__IsLayerVisible(sheet, viewport.Viewport__LayerId);
            frame.classList.toggle(Na__LeSurface__CLASS_FRAME + '--locked', Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId));
            if (frame.hidden) return;
            const body = frame.firstElementChild;
            if (is3d) Na__LeVp3d__Fill(body, sheet, viewport, ppm); else Na__LeVp2d__Fill(body, sheet, viewport, ppm);
        });

        Array.from(Na__LeSurface__Frames.children).forEach((frame) => {
            const id = frame.getAttribute('data-na-viewport-id');
            if (alive.has(id)) return;
            if (frame.classList.contains(Na__LeSurface__CLASS_FRAME + '--3d')) Na__LeVp3d__Release(id); else Na__LeVp2d__Release(id);
            frame.remove();
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Replace an SVG Layer on the Paper
    // ------------------------------------------------------------
    function Na__LeSurface__SwapSvg(current, markup, className, before) {
        const holder = document.createElement('div');
        holder.innerHTML = markup;
        const svg = holder.firstElementChild;
        if (!svg) return current;
        svg.setAttribute('class', className);
        svg.style.width  = Na__LeSurface__Paper.style.width;
        svg.style.height = Na__LeSurface__Paper.style.height;
        if (current && current.parentNode) current.parentNode.replaceChild(svg, current);
        else if (before && before.parentNode) Na__LeSurface__Paper.insertBefore(svg, before);
        else Na__LeSurface__Paper.appendChild(svg);
        return svg;
    }
    // ------------------------------------------------------------


    // FUNCTION | Redraw the Chrome (border, title block, captions)
    // ------------------------------------------------------------
    function Na__LeSurface__RefreshChrome() {
        const sheet = Na__LeSurface__Sheet;
        if (!sheet || !Na__LeSurface__Layout || !Na__LeSurface__Paper) return;
        const primitives = Na__LeChrome__Build(Na__LeSurface__Layout, sheet, { fields : Na__LeModel__GetFields(sheet) });
        const markup     = Na__LeChrome__ToSvgMarkup(primitives, Na__LeSurface__Layout.Page.WidthMm, Na__LeSurface__Layout.Page.HeightMm, 'na-le-paper__chrome');
        Na__LeSurface__ChromeSvg = Na__LeSurface__SwapSvg(Na__LeSurface__ChromeSvg, markup, 'na-le-paper__chrome', Na__LeSurface__MarkupSvg || Na__LeSurface__Handles);
    }
    // ------------------------------------------------------------


    // FUNCTION | Redraw the Sheet's Own Markup
    // ------------------------------------------------------------
    function Na__LeSurface__RefreshMarkup() {
        const sheet = Na__LeSurface__Sheet;
        if (!sheet || !Na__LeSurface__Layout || !Na__LeSurface__Paper) return;
        const primitives = Na__LeMarkup__BuildSheetPrimitives(sheet, Na__LeSurface__Layout, Na__LeModel__GetSelection());
        const markup     = Na__LeChrome__ToSvgMarkup(primitives, Na__LeSurface__Layout.Page.WidthMm, Na__LeSurface__Layout.Page.HeightMm, 'na-le-paper__markup');
        Na__LeSurface__MarkupSvg = Na__LeSurface__SwapSvg(Na__LeSurface__MarkupSvg, markup, 'na-le-paper__markup', Na__LeSurface__Handles);
    }
    // ------------------------------------------------------------


    // FUNCTION | Redraw the Selected Viewport's Outline and Handles
    // ------------------------------------------------------------
    function Na__LeSurface__RefreshSelection() {
        const sheet = Na__LeSurface__Sheet;
        if (!sheet || !Na__LeSurface__Paper) return;
        if (!Na__LeSurface__Handles) Na__LeSurface__Handles = Na__LeSurface__El('div', 'na-le-paper__handles', Na__LeSurface__Paper);
        const selection = Na__LeModel__GetSelection();
        const viewport  = (selection && selection.kind === 'viewport')
            ? sheet.Sheet__Viewports.find((v) => v.Viewport__Id === selection.id) || null
            : null;
        Na__LeSurface__Frames.querySelectorAll('.' + Na__LeSurface__CLASS_FRAME).forEach((frame) => {
            frame.classList.toggle(Na__LeSurface__CLASS_FRAME + '--selected', !!viewport && frame.getAttribute('data-na-viewport-id') === viewport.Viewport__Id);
        });
        if (!viewport) {
            Na__LeSurface__EditingId = null;
            Na__LeHandles__Clear(Na__LeSurface__Handles);
            if (selection && Na__LeSurface__Editable) Na__LeGrips__Render(Na__LeSurface__Handles, sheet, selection, Na__LeSurface__Ppm, Na__LeSurface__Zoom);   // <-- Dimension and shape grips
            return;
        }
        if (!Na__LeModel__IsLayerVisible(sheet, viewport.Viewport__LayerId)) { Na__LeSurface__EditingId = null; Na__LeHandles__Clear(Na__LeSurface__Handles); return; }
        const locked = Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId) || viewport.Viewport__Locked === true;
        if (Na__LeSurface__EditingId && (Na__LeSurface__EditingId !== viewport.Viewport__Id || locked)) Na__LeSurface__EditingId = null;   // <-- Content editing ends with the selection, or with a lock
        Na__LeHandles__Render(Na__LeSurface__Handles, viewport, Na__LeSurface__Ppm, Na__LeSurface__Zoom, Na__LeSurface__Editable && !locked,
            { editing : Na__LeSurface__EditingId === viewport.Viewport__Id, locked : locked });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Surface API
    // ------------------------------------------------------------
    export {
        Na__LeSurface__ZOOM_EVENT,
        Na__LeSurface__Mount,
        Na__LeSurface__Unmount,
        Na__LeSurface__SetSheet,
        Na__LeSurface__Refresh,
        Na__LeSurface__SetZoom,
        Na__LeSurface__GetZoom,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__ClientToPaperMm,
        Na__LeSurface__PaperMmToClient,
        Na__LeSurface__SetEditingViewport,
        Na__LeSurface__GetEditingViewport,
        Na__LeSurface__GetSheet,
        Na__LeSurface__GetLayout,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetFrameBody
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
