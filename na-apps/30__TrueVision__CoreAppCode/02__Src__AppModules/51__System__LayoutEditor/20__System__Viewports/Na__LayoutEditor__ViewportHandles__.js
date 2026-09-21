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
// - Rotation (TrueVision): a round grip on a stem off the middle of the top
//   edge turns the viewport about the middle of its frame (RotateStart,
//   RotateTo; Shift holds Viewport RotateStepDeg steps, a quarter turn). A
//   turned frame keeps all of the above: the outline and handles are drawn
//   turned, a hit is tested with the point turned back into the level frame,
//   and a crop or a pan is worked in the frame's own axes, with the edge
//   opposite the handle kept where it is on the paper
//   (Na__LayoutEditor__ViewportRotation__).
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
// 21-Sep-2026 - Version 1.5.0 (TrueVision)
// - ROTATABLE VIEWPORTS. Render draws the outline and the eight handles on the
//   turned frame, and a rotate grip on a stem off the middle of its top edge
//   (RotateGrip, OnRotateGrip). RotateStart and RotateTo turn it about the
//   middle of the frame; Shift holds the turn to Viewport RotateStepDeg (90),
//   and without Shift it settles on a right angle within RotateDetentDeg.
// - HitTest and Contains read the point turned back into the level frame.
//   CaptureStart keeps the turn; DragPatch turns the pointer's travel into the
//   frame's own axes for a crop or a pan, and puts a cropped frame's middle
//   where the edge opposite the handle stays put (TurnedRect). A border move
//   is still a plain paper move. CursorFor turns a handle's arrow with the frame.
// - The outline and the handles are carried to their place by a transform
//   (PlaceAt, the grips' own rule), not by left and top, which the browser
//   rounds before the paper's zoom multiplies the difference.
//
// 14-Sep-2026 - Version 1.4.0
// - The note over a 3D viewport whose content is being edited gives its zoom
//   and how to change it ("Zoom 150%: scroll to zoom (Shift for fine steps),
//   drag to reposition, Enter to finish"). A 2D viewport's says Enter or Esc.
//
// 14-Sep-2026 - Version 1.3.0
// - RenderOutlines: an outline on each of several selected viewports and no
//   handles, for a multi-selection. Render and it share one outline builder.
//
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
    import { Na__LeCfg__GetViewportSetup, Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__KIND_3D, Na__LeModel__GetLayers, Na__LeModel__IsLayerVisible } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Viewport Rotation (a leaf: the turned frame's geometry)
    // ------------------------------------------------------------
    import {
        Na__LeVpRot__Deg,
        Na__LeVpRot__Settle,
        Na__LeVpRot__TurnVector,
        Na__LeVpRot__Centre,
        Na__LeVpRot__ToPaper,
        Na__LeVpRot__ToFrame,
        Na__LeVpRot__Contains,
        Na__LeVpRot__CssRotate
    } from './Na__LayoutEditor__ViewportRotation__.js';
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

    // MODULE CONSTANTS | Which Way Each Handle Faces on a Level Frame, and the Resize Cursor for a Heading
    // ------------------------------------------------------------
    // Degrees clockwise from pointing right, in 45 degree steps. A turned frame
    // adds its turn and takes the cursor for the nearest eighth, so a side
    // handle on a frame turned a quarter wears the up-and-down arrow.
    // ------------------------------------------------------------
    const Na__LeHandles__HEADINGS = { rc : 0, br : 45, bc : 90, bl : 135, lc : 180, tl : 225, tc : 270, tr : 315 };
    const Na__LeHandles__RESIZE_BY_EIGHTH = [ 'ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize' ];
    const Na__LeHandles__ROTATE_MIN_MM    = 0.25;                                // <-- Nearer the middle than this a pointer's angle means nothing, so a rotate drag holds still
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
    // viewport is optional: given a turned one, a handle's arrow turns with it.
    // ------------------------------------------------------------
    function Na__LeHandles__CursorFor(hit, viewport) {
        if (!hit) return '';
        if (hit.mode === 'handle') {
            const deg = Na__LeVpRot__Deg(viewport);
            if (!deg || !(hit.key in Na__LeHandles__HEADINGS)) return Na__LeHandles__CURSORS[hit.key] || 'default';
            const eighth = ((Math.round((Na__LeHandles__HEADINGS[hit.key] + deg) / 45) % 8) + 8) % 8;
            return Na__LeHandles__RESIZE_BY_EIGHTH[eighth % 4];
        }
        if (hit.mode === 'border') return 'move';
        return 'grab';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Carry an Element in the Handles Layer to a Paper Point by a Transform
    // ------------------------------------------------------------
    // The grips' rule (Na__LayoutEditor__Grips__ Place): left and top are
    // rounded to a whole device pixel BEFORE the paper's scale(zoom), which
    // multiplies the difference, so an element placed by them stands up to half
    // a pixel times the zoom off its point. It sits at left 0, top 0 with its
    // origin there, and the transform - read right to left - puts its MIDDLE on
    // the origin, turns it, scales it back to screen pixels and carries it to
    // the point. Its width and height are therefore SCREEN pixels.
    // ------------------------------------------------------------
    function Na__LeHandles__PlaceAt(el, xPx, yPx, zoom, turnDeg) {
        el.style.left            = '0px';
        el.style.top             = '0px';
        el.style.transformOrigin = '0 0';
        el.style.transform       = 'translate(' + xPx + 'px, ' + yPx + 'px) scale(' + (1 / (zoom > 0 ? zoom : 1)) + ')' + (turnDeg ? ' rotate(' + turnDeg + 'deg)' : '') + ' translate(-50%, -50%)';
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Selected Viewport's Rotate Grip Stands: { base, grip }, Paper Points
    // ------------------------------------------------------------
    // Straight out from the middle of the frame's top edge - the top as the
    // frame stands level, wherever the turn has put it - Viewport
    // RotateGripOffsetPx further on screen at any zoom. base is where the stem
    // leaves the frame; the caption hangs off the bottom corner, so the top
    // is clear.
    // ------------------------------------------------------------
    function Na__LeHandles__RotateGrip(viewport, ppm, zoom) {
        const f     = viewport.Viewport__FrameMm;
        const reach = Na__LeCfg__GetViewportSetup().rotateGripOffsetPx / Math.max(1e-6, ppm * zoom);
        const midX  = f.X + (f.WidthMm / 2);
        return { base : Na__LeVpRot__ToPaper(viewport, midX, f.Y), grip : Na__LeVpRot__ToPaper(viewport, midX, f.Y - reach) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Paper Point on the Selected Viewport's Rotate Grip
    // ------------------------------------------------------------
    // Found at the handles' own hit radius. Whether the grip is there at all
    // (one viewport selected, editable, unlocked, not being edited inside) is
    // the caller's question - the same one that decides whether it is drawn.
    // ------------------------------------------------------------
    function Na__LeHandles__OnRotateGrip(viewport, pointMm, ppm, zoom) {
        if (!viewport || !pointMm) return false;
        const at     = Na__LeHandles__RotateGrip(viewport, ppm, zoom);
        const radius = Na__LeCfg__GetViewportSetup().handleHitRadiusPx / Math.max(1e-6, ppm * zoom);
        return Math.hypot(pointMm.x - at.grip.x, pointMm.y - at.grip.y) <= radius;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Outline Element Over a Viewport's Frame
    // ------------------------------------------------------------
    // Carried to the frame by a translate, as the frame itself is (the sheet
    // surface's RefreshFrames), and turned with it about its middle - so the
    // outline lies exactly on the frame at any zoom and any turn.
    // ------------------------------------------------------------
    function Na__LeHandles__Outline(layer, viewport, ppm, zoom, className) {
        const rect    = viewport.Viewport__FrameMm;
        const outline = document.createElement('div');
        outline.className = className;
        outline.style.left   = '0px';
        outline.style.top    = '0px';
        outline.style.transformOrigin = '50% 50%';                               // <-- The middle of the frame: what a turn is about
        outline.style.transform = 'translate(' + (rect.X * ppm) + 'px, ' + (rect.Y * ppm) + 'px)' + Na__LeVpRot__CssRotate(Na__LeVpRot__Deg(viewport));
        outline.style.width  = (rect.WidthMm  * ppm) + 'px';
        outline.style.height = (rect.HeightMm * ppm) + 'px';
        outline.style.borderWidth = Math.max(1, 1.5 / zoom) + 'px';
        layer.appendChild(outline);
        return outline;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Note Over a Viewport Whose Content Is Being Edited
    // ------------------------------------------------------------
    // A 3D viewport's note says how far its picture is zoomed and how to change
    // it. The zoom is read straight off the record, which
    // Na__LayoutEditor__Viewport3dZoom__ writes; importing that module here
    // would loop back through the sheet surface.
    // ------------------------------------------------------------
    function Na__LeHandles__EditingNote(viewport) {
        if (viewport.Viewport__Kind !== Na__LeModel__KIND_3D) return Na__LeCfg__GetLabel('EditingViewNote', 'Editing viewport content: drag to reposition, Enter or Esc to finish');
        const zoom = (typeof viewport.Viewport__ImageZoom === 'number' && viewport.Viewport__ImageZoom > 0) ? viewport.Viewport__ImageZoom : 1;
        return Na__LeCfg__FormatLabel('EditingView3dNote', 'Zoom {zoom}%: scroll to zoom (Shift for fine steps), drag to reposition, Enter to finish', { zoom : Math.round(zoom * 1000) / 10 });
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Outline and Handles Into the Selection Layer
    // ------------------------------------------------------------
    function Na__LeHandles__Render(layer, viewport, ppm, zoom, editable, options) {
        if (!layer) return;
        Na__LeHandles__Clear(layer);
        const state = options || {};
        const rect   = viewport.Viewport__FrameMm;
        const setup  = Na__LeCfg__GetViewportSetup();
        const sizePx = setup.handleSizePx / zoom;                                // <-- Constant on screen at any zoom

        const outline = Na__LeHandles__Outline(layer, viewport, ppm, zoom,
            'na-le-selection' + (editable ? '' : ' na-le-selection--readonly') + (state.editing ? ' na-le-selection--editing' : '') + (state.locked ? ' na-le-selection--locked' : ''));
        if (state.editing)     outline.setAttribute('data-na-note', Na__LeHandles__EditingNote(viewport));
        else if (state.locked) outline.setAttribute('data-na-note', Na__LeCfg__GetLabel('LockedNote', 'Locked'));
        outline.style.setProperty('--na-le-note-scale', String(1 / zoom));   // <-- The note reads the same at any zoom
        if (!editable || state.editing || state.locked) return;                 // <-- No handles while the content is being edited, or when locked

        // THE HANDLES SIT ON THE TURNED FRAME and turn with it, each carried to
        // its point by a transform (PlaceAt) at its size in SCREEN pixels, with
        // a one-pixel edge - the scale inside the transform takes both back
        // down, so they read the same at any zoom.
        const deg    = Na__LeVpRot__Deg(viewport);
        const screen = Math.round(sizePx * (zoom > 0 ? zoom : 1));
        Na__LeHandles__KEYS.forEach((key) => {
            const level  = Na__LeHandles__Anchor(rect, key);
            const anchor = Na__LeVpRot__ToPaper(viewport, level.x, level.y);
            const handle = document.createElement('div');
            handle.className = 'na-le-handle na-le-handle--' + key + (Na__LeHandles__IsEnabled(viewport, key) ? '' : ' na-le-handle--disabled');
            handle.style.width  = screen + 'px';
            handle.style.height = screen + 'px';
            handle.style.borderWidth = '1px';                                    // <-- One screen pixel: the transform scales the element, edge and all
            Na__LeHandles__PlaceAt(handle, anchor.x * ppm, anchor.y * ppm, zoom, deg);
            layer.appendChild(handle);
        });

        // THE ROTATE GRIP | Round, on a stem off the middle of the top edge, as
        // a text item's is (Na__LayoutEditor__Grips__). Drag it to turn the
        // viewport about the middle of its frame; Shift holds the turn to
        // Viewport RotateStepDeg steps (a quarter turn).
        const at = Na__LeHandles__RotateGrip(viewport, ppm, zoom);
        const scale = zoom > 0 ? zoom : 1;
        const stem  = document.createElement('div');
        stem.className = 'na-le-grip na-le-grip--stem';
        stem.style.left      = '0px';
        stem.style.top       = '0px';
        stem.style.transformOrigin = '0 0';
        stem.style.width     = (Math.hypot(at.grip.x - at.base.x, at.grip.y - at.base.y) * ppm * scale) + 'px';   // <-- Its length on SCREEN: the transform scales it, and its one-pixel line, back down
        stem.style.transform = 'translate(' + (at.base.x * ppm) + 'px, ' + (at.base.y * ppm) + 'px) rotate(' + (Math.atan2(at.grip.y - at.base.y, at.grip.x - at.base.x) * (180 / Math.PI)) + 'deg) scale(' + (1 / scale) + ')';
        layer.appendChild(stem);
        const grip = document.createElement('div');
        grip.className = 'na-le-grip na-le-grip--rotate na-le-grip--viewport-rotate';
        grip.style.width  = screen + 'px';
        grip.style.height = screen + 'px';
        Na__LeHandles__PlaceAt(grip, at.grip.x * ppm, at.grip.y * ppm, zoom, 0);
        layer.appendChild(grip);
    }
    // ------------------------------------------------------------


    // FUNCTION | Outline Several Selected Viewports, With No Handles
    // ------------------------------------------------------------
    // isLocked(viewport) greys a locked one's outline, as Render does. There are
    // no notes: a label over every frame of a multi-selection would bury the
    // sheet under them.
    // ------------------------------------------------------------
    function Na__LeHandles__RenderOutlines(layer, viewports, ppm, zoom, isLocked) {
        if (!layer) return;
        Na__LeHandles__Clear(layer);
        (viewports || []).forEach((viewport) => {
            const locked = typeof isLocked === 'function' && isLocked(viewport) === true;
            Na__LeHandles__Outline(layer, viewport, ppm, zoom, 'na-le-selection' + (locked ? ' na-le-selection--locked' : ''));
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
    // A turned frame is asked the same question with the point turned back
    // into the level frame, where the handles and the band are where they
    // always were; a turn is rigid, so the radius and the band are unchanged.
    // ------------------------------------------------------------
    function Na__LeHandles__HitTest(viewport, paperMm, ppm, zoom, selected) {
        const rect   = viewport.Viewport__FrameMm;
        const setup  = Na__LeCfg__GetViewportSetup();
        const radius = setup.handleHitRadiusPx / (ppm * zoom);
        const band   = Na__LeHandles__BORDER_BAND_PX / (ppm * zoom);
        const pointMm = Na__LeVpRot__ToFrame(viewport, paperMm.x, paperMm.y);

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
        return Na__LeVpRot__Contains(viewport, pointMm, 0);                     // <-- The turned frame; the level one when it is not turned
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
            offset : Object.assign({}, viewport.Viewport__ImageOffsetMm),
            deg    : Na__LeVpRot__Deg(viewport)                                  // <-- The turn at the press: a crop or a pan is worked in the frame's own axes
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep a Turned Frame's Fixed Edge Where It Is on the Paper
    // ------------------------------------------------------------
    // The crop arithmetic works in the level frame, where cropping the right
    // edge keeps X and moves the middle right by half the change. A turned
    // frame turns about its middle, so a middle that moved in the frame's own
    // axes has moved along the TURNED axes on the paper. Putting the new
    // middle there - the start's middle plus that shift turned - keeps the
    // edge, or the corner, opposite the handle exactly where it was, and the
    // drawing with it: every point of the frame still maps through the same
    // turn about the start's middle. The window and picture fields are worked
    // in the frame's own axes already and need nothing.
    // ------------------------------------------------------------
    function Na__LeHandles__TurnedRect(start, rect) {
        if (!start.deg || !rect) return rect;
        const sx = start.rect.X + (start.rect.WidthMm / 2), sy = start.rect.Y + (start.rect.HeightMm / 2);
        const lx = (rect.X + (rect.WidthMm / 2)) - sx,      ly = (rect.Y + (rect.HeightMm / 2)) - sy;
        const on = Na__LeVpRot__TurnVector(lx, ly, start.deg);
        return Object.assign({}, rect, { X : sx + on.x - (rect.WidthMm / 2), Y : sy + on.y - (rect.HeightMm / 2) });
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
            return { rect : { X : start.rect.X + dMm.x, Y : start.rect.Y + dMm.y } };   // <-- A move is a move on the paper, turned or not
        }
        // A PAN OR A CROP IS WORKED IN THE FRAME'S OWN AXES: the pointer's
        // travel is turned back by the frame's turn first, so dragging along a
        // turned frame's edge crops along that edge and a turned drawing slides
        // under the hand the way the hand went.
        const local = start.deg ? Na__LeVpRot__TurnVector(dMm.x, dMm.y, -start.deg) : dMm;
        if (hit.mode === 'body') {
            if (is3d) return { imageOffset : { X : start.offset.X + local.x, Y : start.offset.Y + local.y } };
            const denominator = viewport.Viewport__ScaleDenominator;
            return { pan : { X : start.pan.X - (local.x * denominator), Y : start.pan.Y - (local.y * denominator) } };
        }
        if (hit.mode === 'handle') {
            // Every handle crops or extends the frame in the axes it names; a
            // corner does both. Shift on a 3D corner scales the picture instead.
            const isCorner = Na__LeHandles__CORNERS.indexOf(hit.key) >= 0;
            const patch = is3d
                ? ((isCorner && mods.shift) ? Na__LeHandles__Corner3d(start, hit.key, local, minSize) : Na__LeHandles__Resize3d(start, hit.key, local, minSize))
                : Na__LeHandles__Resize2d(start, hit.key, local, minSize, viewport.Viewport__ScaleDenominator);
            if (patch && patch.rect) patch.rect = Na__LeHandles__TurnedRect(start, patch.rect);
            return patch;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hold a Viewport Where a Drag on Its Rotate Grip Begins
    // ------------------------------------------------------------
    // The middle stays put for the whole drag, and the turn changes by as much
    // as the pointer has swung round that middle since the press - so a press
    // a little off the centre of the grip does not make the viewport jump.
    // ------------------------------------------------------------
    function Na__LeHandles__RotateStart(viewport, pointMm) {
        if (!viewport || !pointMm) return null;
        const middle = Na__LeVpRot__Centre(viewport);
        return {
            deg     : Na__LeVpRot__Deg(viewport),
            middle  : middle,
            grabDeg : Math.atan2(pointMm.y - middle.y, pointMm.x - middle.x) * (180 / Math.PI)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Patch a Rotate Drag Makes at a Pointer (null too near the middle to read)
    // ------------------------------------------------------------
    // Shift holds the turn to Viewport RotateStepDeg steps - a quarter turn,
    // so 0, 90, 180 and -90 - counted from level, not from where it began.
    // Without Shift it settles on a right angle once within Viewport
    // RotateDetentDeg of one, so level and plumb are found by feel.
    // Returns { rotationDeg } for Na__LeModel__UpdateViewport.
    // ------------------------------------------------------------
    function Na__LeHandles__RotateTo(start, pointMm, shift) {
        if (!start || !pointMm) return null;
        const dx = pointMm.x - start.middle.x, dy = pointMm.y - start.middle.y;
        if (Math.hypot(dx, dy) < Na__LeHandles__ROTATE_MIN_MM) return null;
        const setup = Na__LeCfg__GetViewportSetup();
        const raw   = start.deg + (Math.atan2(dy, dx) * (180 / Math.PI)) - start.grabDeg;
        const tenth = Math.round(raw * 10) / 10;                                 // <-- A tenth of a degree is as fine as a hand can turn it, and what the panel reads
        return { rotationDeg : Na__LeVpRot__Settle(tenth, shift ? setup.rotateStepDeg : 0, setup.rotateDetentDeg) };
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
        Na__LeHandles__RenderOutlines,
        Na__LeHandles__FrontToBack,
        Na__LeHandles__Clear,
        Na__LeHandles__HitTest,
        Na__LeHandles__Contains,
        Na__LeHandles__CursorFor,
        Na__LeHandles__CaptureStart,
        Na__LeHandles__DragPatch,
        Na__LeHandles__RotateGrip,
        Na__LeHandles__OnRotateGrip,
        Na__LeHandles__RotateStart,
        Na__LeHandles__RotateTo
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
