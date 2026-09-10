// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT HANDLES
// =============================================================================
//
// FILE       : Na__LayoutEditor__ViewportHandles__.js
// NAMESPACE  : Na__LeHandles
// MODULE     : Layout Editor - Viewport Handles
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Eight handles and a border on the selected viewport, hit tests, and the drag arithmetic behind them
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Rendering: an outline and eight handle squares in the selection layer,
//   counter-scaled by the zoom so they keep their pixel size.
// - Hit testing in paper millimetres: a handle, the border band (drag to
//   move the frame), the inside (drag to pan the content), or nothing.
// - Drag arithmetic is pure: given the state at pointer down and a delta in
//   paper millimetres, it returns the patch the sheet model applies.
//     2D (D29): edges crop or extend the window while the drawing stays put
//     on the paper (the pan compensates), inside drag pans the drawing,
//     corners do nothing.
//     3D (D30): corners scale the image proportionally about the opposite
//     corner, edges crop the frame while the image stays put, inside drag
//     moves the image within the frame.
//
// INTEGRATION:
// - The sheet surface renders; the sheet tools hit test and drag.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__ViewportHandles__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.2.0
// - Clear leaves the snap marker, the rubber band and an open text field in place. FrontToBack lifted from the sheet tools.
//
// 10-Sep-2026 - Version 1.1.0
// - Corners crop or extend both axes on either kind (Shift on a 3D corner scales); outline carries editing and locked states and hides the handles then.
//
// 10-Sep-2026 - Version 1.0.1
// - Fix: the left and right edge handles were both being drawn, and hit
//   tested, at the centre of the frame, so a viewport could not be cropped
//   or extended along x at all. Anchor was reading the handle key by
//   character position, which only holds for the keys that spell the
//   vertical edge first; 'lc' and 'rc' spell the horizontal edge first and
//   both collapsed to the middle. It now reads the key by content.
//   The drag arithmetic was already correct for both keys.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and Model Kinds
    // ------------------------------------------------------------
    import { Na__LeCfg__GetViewportSetup, Na__LeCfg__GetLabel } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__KIND_3D, Na__LeModel__GetLayers, Na__LeModel__IsLayerVisible } from './Na__LayoutEditor__SheetModel__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Handle Keys, Cursors and the Border Band
    // ------------------------------------------------------------
    const Na__LeHandles__KEYS    = [ 'tl', 'tc', 'tr', 'rc', 'br', 'bc', 'bl', 'lc' ];
    const Na__LeHandles__CORNERS = [ 'tl', 'tr', 'bl', 'br' ];
    const Na__LeHandles__CURSORS = { tl : 'nwse-resize', br : 'nwse-resize', tr : 'nesw-resize', bl : 'nesw-resize', tc : 'ns-resize', bc : 'ns-resize', lc : 'ew-resize', rc : 'ew-resize' };
    const Na__LeHandles__BORDER_BAND_PX = 7;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Paper Position of a Handle
    // ------------------------------------------------------------
    // The key names an edge per axis, and it is read by CONTENT rather than
    // by character position. The corner and top and bottom keys spell the
    // vertical edge first ('tl', 'bc') while the side keys spell the
    // horizontal edge first ('lc', 'rc'), so reading key[0] and key[1] by
    // position lands both side handles on the centre of the frame instead of
    // on its left and right edges. A missing axis means the middle of that
    // axis, which is what puts 'tc' half way across and 'lc' half way down.
    function Na__LeHandles__Anchor(rect, key) {
        const left   = key.indexOf('l') >= 0;
        const right  = key.indexOf('r') >= 0;
        const top    = key.indexOf('t') >= 0;
        const bottom = key.indexOf('b') >= 0;
        const x = left ? rect.X : (right  ? rect.X + rect.WidthMm  : rect.X + (rect.WidthMm  / 2));
        const y = top  ? rect.Y : (bottom ? rect.Y + rect.HeightMm : rect.Y + (rect.HeightMm / 2));
        return { x : x, y : y };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Handle Active for This Viewport Kind
    // ------------------------------------------------------------
    function Na__LeHandles__IsEnabled(viewport, key) {
        return !!viewport && !!key;                                              // <-- Every handle crops or extends; corners do both axes
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cursor for a Hit
    // ------------------------------------------------------------
    function Na__LeHandles__CursorFor(hit) {
        if (!hit) return '';
        if (hit.mode === 'handle') return Na__LeHandles__CURSORS[hit.key] || 'default';
        if (hit.mode === 'border') return 'move';
        return 'grab';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // FUNCTION | Draw the Outline and Handles Into the Selection Layer
    // ------------------------------------------------------------
    function Na__LeHandles__Render(layer, viewport, ppm, zoom, editable, options) {
        if (!layer) return;
        Na__LeHandles__Clear(layer);
        const state = options || {};
        const rect   = viewport.Viewport__FrameMm;
        const setup  = Na__LeCfg__GetViewportSetup();
        const sizePx = setup.handleSizePx / zoom;                                // <-- Constant on screen at any zoom

        const outline = document.createElement('div');
        outline.className = 'na-le-selection' + (editable ? '' : ' na-le-selection--readonly') + (state.editing ? ' na-le-selection--editing' : '') + (state.locked ? ' na-le-selection--locked' : '');
        outline.style.left   = (rect.X * ppm) + 'px';
        outline.style.top    = (rect.Y * ppm) + 'px';
        outline.style.width  = (rect.WidthMm  * ppm) + 'px';
        outline.style.height = (rect.HeightMm * ppm) + 'px';
        outline.style.borderWidth = Math.max(1, 1.5 / zoom) + 'px';
        if (state.editing)     outline.setAttribute('data-na-note', Na__LeCfg__GetLabel('EditingViewNote', 'Editing viewport content: drag to reposition, Esc to finish'));
        else if (state.locked) outline.setAttribute('data-na-note', Na__LeCfg__GetLabel('LockedNote', 'Locked'));
        outline.style.setProperty('--na-le-note-scale', String(1 / zoom));   // <-- The note reads the same at any zoom
        layer.appendChild(outline);
        if (!editable || state.editing || state.locked) return;                 // <-- No handles while the content is being edited, or when locked

        Na__LeHandles__KEYS.forEach((key) => {
            const anchor = Na__LeHandles__Anchor(rect, key);
            const handle = document.createElement('div');
            handle.className = 'na-le-handle na-le-handle--' + key + (Na__LeHandles__IsEnabled(viewport, key) ? '' : ' na-le-handle--disabled');
            handle.style.left   = ((anchor.x * ppm) - (sizePx / 2)) + 'px';
            handle.style.top    = ((anchor.y * ppm) - (sizePx / 2)) + 'px';
            handle.style.width  = sizePx + 'px';
            handle.style.height = sizePx + 'px';
            handle.style.borderWidth = Math.max(1, 1 / zoom) + 'px';
            layer.appendChild(handle);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Empty the Selection Layer
    // ------------------------------------------------------------
    function Na__LeHandles__Clear(layer) {
        if (!layer) return;
        layer.querySelectorAll('.na-le-selection, .na-le-handle, .na-le-grip').forEach((el) => el.remove());   // <-- The snap marker, the band and an open text field stay
    }
    // ------------------------------------------------------------


    // FUNCTION | Visible Viewports Front to Back (top of the layer list first)
    // ------------------------------------------------------------
    function Na__LeHandles__FrontToBack(sheet) {
        const layers = Na__LeModel__GetLayers(sheet).map((l) => l.Layer__Id);
        return sheet.Sheet__Viewports.map((v, i) => ({ v : v, rank : layers.indexOf(v.Viewport__LayerId), i : i }))
            .filter((e) => Na__LeModel__IsLayerVisible(sheet, e.v.Viewport__LayerId))
            .sort((a, b) => (a.rank - b.rank) || (b.i - a.i))
            .map((e) => e.v);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hit Testing
// -----------------------------------------------------------------------------

    // FUNCTION | What Is Under a Paper Point on a Viewport
    // ------------------------------------------------------------
    // Returns { mode : 'handle', key } | { mode : 'border' } | { mode : 'body' } | null.
    // selected: handles and the border only exist on the selected viewport.
    // ------------------------------------------------------------
    function Na__LeHandles__HitTest(viewport, pointMm, ppm, zoom, selected) {
        const rect   = viewport.Viewport__FrameMm;
        const setup  = Na__LeCfg__GetViewportSetup();
        const radius = setup.handleHitRadiusPx / (ppm * zoom);
        const band   = Na__LeHandles__BORDER_BAND_PX / (ppm * zoom);

        if (selected) {
            for (let i = 0; i < Na__LeHandles__KEYS.length; i++) {
                const key = Na__LeHandles__KEYS[i];
                const anchor = Na__LeHandles__Anchor(rect, key);
                if (Math.abs(pointMm.x - anchor.x) <= radius && Math.abs(pointMm.y - anchor.y) <= radius) {
                    return Na__LeHandles__IsEnabled(viewport, key) ? { mode : 'handle', key : key } : { mode : 'border' };
                }
            }
        }
        const insideOuter = pointMm.x >= rect.X - band && pointMm.x <= rect.X + rect.WidthMm + band &&
                            pointMm.y >= rect.Y - band && pointMm.y <= rect.Y + rect.HeightMm + band;
        if (!insideOuter) return null;
        const insideInner = pointMm.x >= rect.X + band && pointMm.x <= rect.X + rect.WidthMm - band &&
                            pointMm.y >= rect.Y + band && pointMm.y <= rect.Y + rect.HeightMm - band;
        if (!insideInner) return { mode : 'border' };
        return { mode : 'body' };
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Paper Point Inside a Viewport Frame
    // ------------------------------------------------------------
    function Na__LeHandles__Contains(viewport, pointMm) {
        const rect = viewport.Viewport__FrameMm;
        return pointMm.x >= rect.X && pointMm.x <= rect.X + rect.WidthMm && pointMm.y >= rect.Y && pointMm.y <= rect.Y + rect.HeightMm;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drag Arithmetic
// -----------------------------------------------------------------------------

    // FUNCTION | Snapshot the Fields a Drag Changes
    // ------------------------------------------------------------
    function Na__LeHandles__CaptureStart(viewport) {
        return {
            rect   : Object.assign({}, viewport.Viewport__FrameMm),
            pan    : Object.assign({}, viewport.Viewport__PanMm),
            image  : Object.assign({}, viewport.Viewport__ImageMm),
            offset : Object.assign({}, viewport.Viewport__ImageOffsetMm)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resize One Axis From an Edge, Honouring the Minimum
    // ------------------------------------------------------------
    function Na__LeHandles__ResizeAxis(origin, size, minSize, deltaMm, movingStartEdge) {
        if (movingStartEdge) {
            const newSize = Math.max(minSize, size - deltaMm);
            return { origin : origin + (size - newSize), size : newSize };
        }
        return { origin : origin, size : Math.max(minSize, size + deltaMm) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Crop or Extend a 2D Window From an Edge or a Corner (drawing stays put)
    // ------------------------------------------------------------
    function Na__LeHandles__Resize2d(start, key, dMm, minSize, denominator) {
        const rect = Object.assign({}, start.rect);
        if (key.indexOf('l') >= 0 || key.indexOf('r') >= 0) {
            const r = Na__LeHandles__ResizeAxis(rect.X, rect.WidthMm, minSize, dMm.x, key.indexOf('l') >= 0);
            rect.X = r.origin; rect.WidthMm = r.size;
        }
        if (key.indexOf('t') >= 0 || key.indexOf('b') >= 0) {
            const r = Na__LeHandles__ResizeAxis(rect.Y, rect.HeightMm, minSize, dMm.y, key.indexOf('t') >= 0);
            rect.Y = r.origin; rect.HeightMm = r.size;
        }
        // The drawing stays where it is on the paper: the window centre has
        // moved, so the pan (the drawing millimetre at that centre) moves with it.
        const pan = {
            X : start.pan.X + (((rect.X + (rect.WidthMm  / 2)) - (start.rect.X + (start.rect.WidthMm  / 2))) * denominator),
            Y : start.pan.Y + (((rect.Y + (rect.HeightMm / 2)) - (start.rect.Y + (start.rect.HeightMm / 2))) * denominator)
        };
        return { rect : rect, pan : pan };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Crop or Extend a 3D Frame From an Edge or a Corner (image stays put)
    // ------------------------------------------------------------
    function Na__LeHandles__Resize3d(start, key, dMm, minSize) {
        const rect   = Object.assign({}, start.rect);
        const offset = Object.assign({}, start.offset);
        if (key.indexOf('l') >= 0 || key.indexOf('r') >= 0) {
            const r = Na__LeHandles__ResizeAxis(rect.X, rect.WidthMm, minSize, dMm.x, key.indexOf('l') >= 0);
            if (key.indexOf('l') >= 0) offset.X = start.offset.X - (r.origin - start.rect.X);
            rect.X = r.origin; rect.WidthMm = r.size;
        }
        if (key.indexOf('t') >= 0 || key.indexOf('b') >= 0) {
            const r = Na__LeHandles__ResizeAxis(rect.Y, rect.HeightMm, minSize, dMm.y, key.indexOf('t') >= 0);
            if (key.indexOf('t') >= 0) offset.Y = start.offset.Y - (r.origin - start.rect.Y);
            rect.Y = r.origin; rect.HeightMm = r.size;
        }
        return { rect : rect, imageOffset : offset };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Corner Drag on a 3D Viewport (proportional about the opposite corner)
    // ------------------------------------------------------------
    function Na__LeHandles__Corner3d(start, key, dMm, minSize) {
        const W0 = start.rect.WidthMm, H0 = start.rect.HeightMm;
        const signX = key[1] === 'l' ? -1 : 1;
        const signY = key[0] === 't' ? -1 : 1;
        const byWidth  = (W0 + (signX * dMm.x)) / W0;
        const byHeight = (H0 + (signY * dMm.y)) / H0;
        let scale = (Math.abs(dMm.x) >= Math.abs(dMm.y)) ? byWidth : byHeight;
        scale = Math.max(scale, minSize / Math.min(W0, H0));
        const newW = W0 * scale, newH = H0 * scale;
        // Anchor: the opposite corner, in the old frame's local millimetres.
        const anchorX = key[1] === 'l' ? W0 : 0;
        const anchorY = key[0] === 't' ? H0 : 0;
        const shiftX  = key[1] === 'l' ? W0 - newW : 0;                          // <-- Where the new top-left lands, old-local
        const shiftY  = key[0] === 't' ? H0 - newH : 0;
        const rect = { X : start.rect.X + shiftX, Y : start.rect.Y + shiftY, WidthMm : newW, HeightMm : newH };
        const offset = {
            X : (anchorX + ((start.offset.X - anchorX) * scale)) - shiftX,
            Y : (anchorY + ((start.offset.Y - anchorY) * scale)) - shiftY
        };
        const image = { WidthMm : start.image.WidthMm * scale, HeightMm : start.image.HeightMm * scale };
        return { rect : rect, imageMm : image, imageOffset : offset };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Model Patch for a Drag in Progress
    // ------------------------------------------------------------
    // hit   : from HitTest at pointer down
    // start : from CaptureStart at pointer down
    // dMm   : { x, y } pointer delta in paper millimetres
    // Returns a patch for Na__LeModel__UpdateViewport, or null for a no-op.
    // ------------------------------------------------------------
    function Na__LeHandles__DragPatch(viewport, hit, start, dMm, modifiers) {
        const is3d    = viewport.Viewport__Kind === Na__LeModel__KIND_3D;
        const minSize = Na__LeCfg__GetViewportSetup().minSizeMm;
        const mods    = modifiers || {};
        if (!hit) return null;

        if (hit.mode === 'border') {
            return { rect : { X : start.rect.X + dMm.x, Y : start.rect.Y + dMm.y } };
        }
        if (hit.mode === 'body') {
            if (is3d) return { imageOffset : { X : start.offset.X + dMm.x, Y : start.offset.Y + dMm.y } };
            const denominator = viewport.Viewport__ScaleDenominator;
            return { pan : { X : start.pan.X - (dMm.x * denominator), Y : start.pan.Y - (dMm.y * denominator) } };
        }
        if (hit.mode === 'handle') {
            // Every handle crops or extends the frame in the axes it names; a
            // corner does both. Shift on a 3D corner scales the picture instead.
            const isCorner = Na__LeHandles__CORNERS.indexOf(hit.key) >= 0;
            if (is3d) return (isCorner && mods.shift) ? Na__LeHandles__Corner3d(start, hit.key, dMm, minSize) : Na__LeHandles__Resize3d(start, hit.key, dMm, minSize);
            return Na__LeHandles__Resize2d(start, hit.key, dMm, minSize, viewport.Viewport__ScaleDenominator);
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport Handles API
    // ------------------------------------------------------------
    export {
        Na__LeHandles__Render,
        Na__LeHandles__FrontToBack,
        Na__LeHandles__Clear,
        Na__LeHandles__HitTest,
        Na__LeHandles__Contains,
        Na__LeHandles__CursorFor,
        Na__LeHandles__CaptureStart,
        Na__LeHandles__DragPatch
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
