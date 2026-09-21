// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OBJECT SNAP - MARKER
// =============================================================================
//
// FILE       : Na__LayoutEditor__ObjectSnap__Marker__.js
// NAMESPACE  : Na__LeOsnap
// MODULE     : Layout Editor - Object Snap - Marker
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The marker that appears on the paper where a snap found its point: its shape says what KIND of point, its colour says what it belongs to
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - TWO THINGS ARE SAID AT ONCE, and neither needs reading.
//     * THE SHAPE is the kind of point found - AutoCAD's glyphs: a square for
//       an endpoint, a triangle for a midpoint, a cross for an intersection, a
//       boxed right angle for a perpendicular, a circle for a centre, an
//       hourglass for the nearest point on a line (Na__LayoutEditor__
//       ObjectSnap__Glyphs__).
//     * THE COLOUR is WHAT WAS SNAPPED TO: purple for a viewport's linework,
//       blue for a vector, orange for text, red for a dimension, slate for the
//       sheet's own paper and the drawing grid. So a purple square is a corner
//       of the drawing, a blue one a corner of a line drawn over it, and the
//       two can be told apart at the moment it matters - before the click.
//   The colour used to say which TOOL was snapping (blue Draw, orange
//   Dimension, purple a carried viewport), which the hand already knows. Adam,
//   21-Sep-2026: "the colour will tell you what object it's matching with".
// - THE SAME SIZE AND THE SAME LINE AT ANY ZOOM. The marker sits inside the
//   paper, which is scaled by the zoom, so it is drawn at its real size in
//   pixels and then scaled back down by 1 / zoom with a transform. It used to
//   be given a fractional size and a fractional border instead, and Chrome
//   will not draw a border thinner than one device pixel BEFORE the paper's
//   own scale is applied - so zoomed in, the border grew until it swallowed
//   the marker and the square read as a solid blob. A transform has no such
//   floor.
// - PLACED BY THE SAME TRANSFORM, NEVER BY left AND top. A box's left and top
//   are rounded to a whole device pixel BEFORE the paper's scale(zoom) is
//   applied, and the zoom then multiplies what the rounding threw away: up to
//   half a pixel times the zoom. Measured on RB05's ground floor plan at 32x
//   on a 150% display, the marker was painted 9.3 device pixels to the right
//   of the corner it had found (and the drawing 8.2 to the left of it, for
//   the same reason: see the sheet surface's RefreshFrames) - exact at one
//   corner, 17 pixels out at the next, worse the closer the work. Adam,
//   21-Sep-2026: "they don't seem to align with the actual vector points".
//   A translate is carried at full precision through the zoom, so the marker
//   sits at left 0, top 0 and its whole position is in the transform.
// - IT KEEPS ITS SIZE WHEN THE ZOOM CHANGES UNDER IT. The counter-scale is
//   written for the zoom of the moment, and a wheel zoom moves no pointer, so
//   nothing asked for the marker again: zoomed in, it stayed the size the
//   paper had blown it up to until the mouse next moved. It is put right when
//   the zoom settles - with the handles, and for the same reason not on
//   every step (the paper is one held picture while the wheel turns).
// - THE NAME, WHEN ASKED FOR. "Endpoint - Viewport" beside the marker, as
//   AutoCAD's AutoSnap tooltip does it. Off until it is switched on in the
//   snap menu: the words are for learning the shapes and the colours.
//
// INTEGRATION:
// - Na__LayoutEditor__ObjectSnap__Search__ shows the marker for every Snap, and
//   re-exports ShowMarker and HideMarker for the tools that place it
//   themselves (an inferred dimension line, a held axis, a carried viewport).
// - The colours live in Na__LayoutEditor__Styles__ObjectSnap__.css.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026). ShowMarker and HideMarker
//                   came across from 30__System__SheetTools/Na__LayoutEditor__Snapping__.js
//                   1.5.0, where the marker was a bordered box toned by tool.
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Moved here from the Snapping module and redrawn: SVG glyphs for eight
//   kinds, coloured by what was snapped to rather than by the tool snapping,
//   counter-scaled by a transform so it survives any zoom, with an optional
//   name beside it.
//
// 21-Sep-2026 - Version 1.1.0
// - The marker is painted ON the point it found. It was placed by left and
//   top, which the browser rounds to a whole device pixel before the paper's
//   zoom multiplies the difference; its position is now part of its transform
//   (PlaceMarker). Measured at 32x on a 150% display: 9.3 device pixels out
//   before, 0.3 after.
// - It is placed again when a zoom settles, so it no longer stays blown up (or
//   shrunk) by a wheel zoom until the mouse next moves.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Surface, the Switches and the Glyphs
    // ------------------------------------------------------------
    import { Na__LeCfg__GetSnappingSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import {
        Na__LeOsnap__KIND_END,
        Na__LeOsnap__KIND_GRID,
        Na__LeOsnap__KIND_INFER,
        Na__LeOsnap__TARGET_SHAPE,
        Na__LeOsnap__TARGET_DIMENSION,
        Na__LeOsnap__TARGET_GRID,
        Na__LeOsnap__IsNaming,
        Na__LeOsnap__WordFor
    } from './Na__LayoutEditor__ObjectSnap__State__.js';
    import { Na__LeOsnap__GlyphSvg } from './Na__LayoutEditor__ObjectSnap__Glyphs__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The One Marker Element, and What It Last Drew
    // ------------------------------------------------------------
    let Na__LeOsnap__Marker      = null;
    let Na__LeOsnap__MarkerGlyph = null;    // <-- The element holding the SVG
    let Na__LeOsnap__MarkerName  = null;    // <-- The element holding the words
    let Na__LeOsnap__MarkerKind  = '';      // <-- The glyph is only re-parsed when the kind changes
    let Na__LeOsnap__MarkerAt    = null;    // <-- { x, y } paper millimetres of the marker on show, for whoever draws to it (the drawing axes)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Marker
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What a Hit Was Snapped To, When It Does Not Say
    // ------------------------------------------------------------
    // A hit from the search always carries its target. One a tool made up for
    // itself does not: a grid point is the grid's, an inferred dimension line
    // is a dimension's, and anything else is drawn as a vector's.
    // ------------------------------------------------------------
    function Na__LeOsnap__TargetOf(hit) {
        if (hit.target) return hit.target;
        if (hit.kind === Na__LeOsnap__KIND_GRID)  return Na__LeOsnap__TARGET_GRID;
        if (hit.kind === Na__LeOsnap__KIND_INFER) return Na__LeOsnap__TARGET_DIMENSION;
        return Na__LeOsnap__TARGET_SHAPE;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Marker's Middle on a Paper Point, at Its Own Size Whatever the Zoom
    // ------------------------------------------------------------
    // THE WHOLE POSITION IS IN THE TRANSFORM. The element sits at left 0, top 0
    // of the handles layer, its transform origin its own top left corner (all
    // three written inline when it is made), and is read right to left: moved back by half its size, so
    // its MIDDLE is at the origin; scaled by 1 / zoom, which the paper's
    // scale(zoom) cancels; then carried to the point. left and top cannot do
    // the last step: the browser rounds them to a whole device pixel before
    // the paper's zoom is applied, and the zoom multiplies the difference.
    // ------------------------------------------------------------
    function Na__LeOsnap__PlaceMarker(xMm, yMm) {
        const ppm  = Na__LeSurface__GetPixelsPerMm();
        const zoom = Math.max(1e-6, Na__LeSurface__GetZoom());
        Na__LeOsnap__Marker.style.transform = 'translate(' + (xMm * ppm) + 'px, ' + (yMm * ppm) + 'px) scale(' + (1 / zoom) + ') translate(-50%, -50%)';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Zoom Has Settled: the Marker on Show Takes Its Size Again
    // ------------------------------------------------------------
    // The counter-scale is written for the zoom of the moment and a wheel zoom
    // moves no pointer, so nothing asks for the marker again. Done when the
    // zoom rests and not on each step, as the handles are: while the wheel
    // turns the paper is one held picture, and a change inside it is a redraw.
    // ------------------------------------------------------------
    function Na__LeOsnap__OnZoomSettled() {
        if (Na__LeOsnap__Marker && !Na__LeOsnap__Marker.hidden && Na__LeOsnap__MarkerAt) Na__LeOsnap__PlaceMarker(Na__LeOsnap__MarkerAt.x, Na__LeOsnap__MarkerAt.y);
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Snap Marker at a Hit
    // ------------------------------------------------------------
    // hit is { x, y, kind, target } in paper millimetres. The element is laid
    // out at its real pixel size and placed about the point by its transform
    // (PlaceMarker), scaled back by 1 / zoom, so its size and its line weight
    // are the same on screen at any zoom and its middle is on the point.
    // ------------------------------------------------------------
    function Na__LeOsnap__ShowMarker(hit) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!layer || !hit || !Number.isFinite(hit.x) || !Number.isFinite(hit.y)) return;
        if (!Na__LeOsnap__Marker) {
            Na__LeOsnap__Marker      = document.createElement('div');
            Na__LeOsnap__MarkerGlyph = document.createElement('div');
            Na__LeOsnap__MarkerName  = document.createElement('div');
            Na__LeOsnap__MarkerGlyph.className = 'na-le-osnap__glyph';
            Na__LeOsnap__MarkerName.className  = 'na-le-osnap__name';
            Na__LeOsnap__Marker.appendChild(Na__LeOsnap__MarkerGlyph);
            Na__LeOsnap__Marker.appendChild(Na__LeOsnap__MarkerName);
            Na__LeOsnap__Marker.style.left            = '0px';                   // <-- At the layer's corner, which is what PlaceMarker's translate is measured from.
            Na__LeOsnap__Marker.style.top             = '0px';                   //     Written here and not left to the stylesheet: a browser holding this file beside
            Na__LeOsnap__Marker.style.transformOrigin = '0 0';                   //     an older copy of the stylesheet (or the other way about) still places it right
            window.addEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeOsnap__OnZoomSettled);   // <-- Once, with the one marker there ever is
        }
        if (Na__LeOsnap__Marker.parentNode !== layer) layer.appendChild(Na__LeOsnap__Marker);
        const kind   = hit.kind || Na__LeOsnap__KIND_END;
        const target = Na__LeOsnap__TargetOf(hit);
        const sizePx = Na__LeCfg__GetSnappingSetup().markerSizePx;
        if (Na__LeOsnap__MarkerKind !== kind) {
            Na__LeOsnap__MarkerGlyph.innerHTML = Na__LeOsnap__GlyphSvg(kind);
            Na__LeOsnap__MarkerKind = kind;
        }
        Na__LeOsnap__Marker.className       = 'na-le-osnap na-le-osnap--' + kind + ' na-le-osnap--to-' + target;
        Na__LeOsnap__Marker.style.width     = sizePx + 'px';
        Na__LeOsnap__Marker.style.height    = sizePx + 'px';
        Na__LeOsnap__PlaceMarker(hit.x, hit.y);
        const naming = Na__LeOsnap__IsNaming();
        Na__LeOsnap__MarkerName.hidden = !naming;
        if (naming) {
            const words = [ Na__LeOsnap__WordFor(kind, ''), Na__LeOsnap__WordFor(target, '') ].filter((word, i, all) => word && all.indexOf(word) === i).join(' - ');   // <-- "Grid", not "Grid - Grid"
            if (Na__LeOsnap__MarkerName.textContent !== words) Na__LeOsnap__MarkerName.textContent = words;
        }
        Na__LeOsnap__MarkerAt = { x : hit.x, y : hit.y };
        Na__LeOsnap__Marker.hidden = false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hide the Marker
    // ------------------------------------------------------------
    function Na__LeOsnap__HideMarker() {
        if (Na__LeOsnap__Marker) Na__LeOsnap__Marker.hidden = true;
        Na__LeOsnap__MarkerAt = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Marker on Show Sits ({ x, y } paper millimetres), or Null
    // ------------------------------------------------------------
    // Read-only, no event and no cost per pointer move: for something that
    // draws TO the snapped point rather than to the raw pointer - the drawing
    // axes cross here, as SketchUp's cross at the inference point. Asked from a
    // pointermove that runs after the sheet tools' own, it is this move's marker.
    // ------------------------------------------------------------
    function Na__LeOsnap__GetMarkerPoint() {
        return (Na__LeOsnap__Marker && !Na__LeOsnap__Marker.hidden) ? Na__LeOsnap__MarkerAt : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Object Snap Marker
    // ------------------------------------------------------------
    export {
        Na__LeOsnap__ShowMarker,
        Na__LeOsnap__HideMarker,
        Na__LeOsnap__GetMarkerPoint
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
