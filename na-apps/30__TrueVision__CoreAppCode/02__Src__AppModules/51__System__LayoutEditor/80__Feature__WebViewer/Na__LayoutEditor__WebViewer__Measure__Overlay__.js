// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - WEB VIEWER - MEASURE - OVERLAY
// =============================================================================
//
// FILE       : Na__LayoutEditor__WebViewer__Measure__Overlay__.js
// NAMESPACE  : Na__LeVwMsOv
// MODULE     : Layout Editor - Web Viewer - Measure - Overlay
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw a reader's measurements, the one being made and the snap it has found, over a published drawing
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - ONE SVG ON THE PAPER, IN PAPER MILLIMETRES. It lies over the published
//   drawing's host inside the same paper element, with the same viewBox as
//   the published sheet, so a measurement sits on the line it was snapped to
//   at every zoom and a pan moves it with the drawing for nothing.
// - CONSTANT ON SCREEN. Lines, ticks, handles, glyphs and text are sized in
//   screen pixels and written in millimetres at the zoom of the moment, so the
//   overlay is redrawn when the zoom changes (a few dozen elements: nothing).
// - THE READER SETS THE DIMENSIONS' SIZE (the menu's Dimension size slider,
//   SetSize): one factor on every line, tick, grip, chip and label of a
//   measurement. The snap marker keeps its own size, so it reads the same
//   whatever the dimensions are set to.
// - DIMENSION-LIKE LABELS. A length reads along its line, upright, just off it;
//   a rectangle's width and height sit outside their edges; an area's value
//   sits inside the shape (inside an L as well), with its perimeter under it.
//   An estimate starts with "≈" (Na__PubDoc__Measure__Maths__).
// - THE SNAP MARKER IS THE EDITOR'S. Its glyphs are Na__LeOsnap__GlyphSvg, the
//   AutoCAD shapes the authoring side marks its own snaps with, coloured as
//   the editor colours a snap to a viewport's linework.
// - IT TAKES NO INPUT. pointer-events are off; the tools hit-test what this
//   reports back from each render (labels and the delete chip).
//
// INTEGRATION:
// - Na__LayoutEditor__WebViewer__Measure__Tool__ owns the state and calls
//   Ensure, Render and Remove.
// - Styles: Na__LayoutEditor__Styles__WebViewer__Measure__.css.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none. TrueVision original.
// - Back-port     : n/a (ValeVision has no web viewer).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.1.0
// - Dimensions a fifth bigger by default, and SetSize for the reader's own
//   size (Adam: "Add a slider for dimension size, and make the default size
//   about 20% bigger"). The snap marker half as big again, 18 to 27 px ("Make
//   the snapping points 50% bigger"), with its name moved out to clear it
//   (TrueVision3D v2.182.0).
//
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.180.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__LeSurface__GetLayout, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__GlyphSvg } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Glyphs__.js';   // <-- The editor's own snap glyphs (pure: imports nothing)
    import {
        Na__PubMsMath__Values, Na__PubMsMath__FormatLength, Na__PubMsMath__FormatArea, Na__PubMsMath__LabelPoint
    } from '../../52__System__Layout__PublishedDocuments/Na__PubDoc__Measure__Maths__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Sizes on Screen, in CSS Pixels
    // ------------------------------------------------------------
    // The dimensions' sizes (Line to Chip) are at the reader's size 1, a fifth
    // over v2.180.0's (19-Oct-2026), and the reader's size multiplies them.
    // The snap marker and the square off the last point are not dimensions:
    // they keep their sizes.
    // ------------------------------------------------------------
    const Na__LeVwMsOv__PX = Object.freeze({
        Line        : 2.2,                                                       // <-- A measurement's line
        Tick        : 6,                                                         // <-- Half a tick across each end of a length
        Dot         : 3.1,                                                       // <-- A placed point
        Handle      : 6.6,                                                       // <-- A selected measurement's grip
        Label       : 14.4,                                                      // <-- A length
        AreaLabel   : 16.2,                                                      // <-- An area's value
        Small       : 12.6,                                                      // <-- A side of an area, a perimeter
        Halo        : 4.1,                                                       // <-- The white edge round every label
        Gap         : 10.8,                                                      // <-- Clear space between a line and its label
        Chip        : 10.8,                                                      // <-- The delete chip's radius
        Glyph       : 27,                                                        // <-- The snap marker (not a dimension: the reader's size leaves it be)
        Name        : 11,                                                        // <-- The snap's name beside it
        Guide       : 1.1,                                                       // <-- The square off the last point
        GuideRun    : 28                                                         // <-- ...and how far it runs on past the point
    });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Reader's Dimension Size
    // ------------------------------------------------------------
    const Na__LeVwMsOv__SIZE = Object.freeze({ Min : 0.6, Max : 2, Default : 1 });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Which Glyph Each Kind of Snap Wears
    // ------------------------------------------------------------
    const Na__LeVwMsOv__GLYPH = Object.freeze({ end : 'end', mid : 'mid', int : 'int', perp : 'perp', near : 'near', axis : 'infer', axisint : 'int' });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Class on the Overlay
    // ------------------------------------------------------------
    const Na__LeVwMsOv__CLASS = 'na-le-viewer-ms__overlay';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Overlay Element, and the Reader's Dimension Size
    // ------------------------------------------------------------
    let Na__LeVwMsOv__Svg  = null;
    let Na__LeVwMsOv__Size = Na__LeVwMsOv__SIZE.Default;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Number for SVG Markup (four decimals of a millimetre)
    // ------------------------------------------------------------
    function Na__LeVwMsOv__N(value) {
        const n = Math.round(Number(value) * 10000) / 10000;
        return Number.isFinite(n) ? String(n) : '0';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Text Made Safe for Markup
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Esc(text) {
        return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------


    // FUNCTION | Paper Millimetres per Screen Pixel at the Zoom of the Moment
    // ------------------------------------------------------------
    function Na__LeVwMsOv__MmPerPx() {
        const scale = (Number(Na__LeSurface__GetPixelsPerMm()) || 3.2) * (Number(Na__LeSurface__GetZoom()) || 1);
        return 1 / scale;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Wide a Label Will Be (an estimate: Open Sans semibold digits run about 0.58 em)
    // ------------------------------------------------------------
    function Na__LeVwMsOv__TextWidth(text, sizeMm) {
        return String(text).length * sizeMm * 0.58;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Angle That Keeps Text Upright (degrees, -90 to 90)
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Upright(dx, dy) {
        let deg = Math.atan2(dy, dx) * 180 / Math.PI;
        if (deg > 90) deg -= 180;
        if (deg <= -90) deg += 180;
        return deg;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Label: Text With a White Edge, Turned Along a Line
    // ------------------------------------------------------------
    // Returns { Markup, Box } - the box (centre, width and height, in mm, and
    // the turn) for hit-testing. cls adds to the label's class.
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Label(text, x, y, sizeMm, deg, k, cls) {
        const width = Na__LeVwMsOv__TextWidth(text, sizeMm);
        const turn  = deg ? ' transform="rotate(' + Na__LeVwMsOv__N(deg) + ' ' + Na__LeVwMsOv__N(x) + ' ' + Na__LeVwMsOv__N(y) + ')"' : '';
        return {
            Markup : '<text class="na-le-viewer-ms__label' + (cls ? ' ' + cls : '') + '" x="' + Na__LeVwMsOv__N(x) + '" y="' + Na__LeVwMsOv__N(y) + '"' +
                     ' font-size="' + Na__LeVwMsOv__N(sizeMm) + '" stroke-width="' + Na__LeVwMsOv__N(Na__LeVwMsOv__PX.Halo * k) + '"' + turn + '>' +
                     Na__LeVwMsOv__Esc(text) + '</text>',
            Box    : { X : x, Y : y, W : width, H : sizeMm * 1.25, Deg : deg || 0 }
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Length's Label Beside the Line From a to b, on the Side Away From `away` (or Above)
    // ------------------------------------------------------------
    function Na__LeVwMsOv__AlongLabel(text, a, b, sizeMm, k, away, cls) {
        const dx = b.X - a.X, dy = b.Y - a.Y;
        const len = Math.hypot(dx, dy) || 1;
        let nx = -dy / len, ny = dx / len;                                       // <-- A normal; flipped below to face the right way
        const mx = (a.X + b.X) / 2, my = (a.Y + b.Y) / 2;
        if (away) {
            if (nx * (away.X - mx) + ny * (away.Y - my) > 0) { nx = -nx; ny = -ny; }   // <-- Outside the shape
        } else if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }       // <-- Above the line (or to its left when it is upright)
        const off = (Na__LeVwMsOv__PX.Gap * k) + sizeMm * 0.5;
        return Na__LeVwMsOv__Label(text, mx + nx * off, my + ny * off, sizeMm, Na__LeVwMsOv__Upright(dx, dy), k, cls);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Delete Chip Beside a Label's Box
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Chip(box, k) {
        const r = Na__LeVwMsOv__PX.Chip * k;
        const a = (box.Deg || 0) * Math.PI / 180;
        const reach = box.W / 2 + r + (4 * k);
        const x = box.X + Math.cos(a) * reach, y = box.Y + Math.sin(a) * reach;
        const arm = r * 0.42;
        return {
            Markup : '<g class="na-le-viewer-ms__chip"><circle cx="' + Na__LeVwMsOv__N(x) + '" cy="' + Na__LeVwMsOv__N(y) + '" r="' + Na__LeVwMsOv__N(r) + '" stroke-width="' + Na__LeVwMsOv__N(1.2 * k) + '"/>' +
                     '<path d="M' + Na__LeVwMsOv__N(x - arm) + ' ' + Na__LeVwMsOv__N(y - arm) + 'L' + Na__LeVwMsOv__N(x + arm) + ' ' + Na__LeVwMsOv__N(y + arm) +
                     'M' + Na__LeVwMsOv__N(x + arm) + ' ' + Na__LeVwMsOv__N(y - arm) + 'L' + Na__LeVwMsOv__N(x - arm) + ' ' + Na__LeVwMsOv__N(y + arm) + '"' +
                     ' stroke-width="' + Na__LeVwMsOv__N(1.6 * k) + '"/></g>',
            Hit    : { X : x, Y : y, R : r }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Measurements
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Points a Selected Measurement Can Be Pulled By
    // ------------------------------------------------------------
    // A rectangle is pulled by any of its four corners; a length by its ends;
    // an area by its corners.
    // ------------------------------------------------------------
    function Na__LeVwMsOv__GripPoints(measure) {
        if (!measure || !Array.isArray(measure.Points)) return [];
        if (measure.Tool === 'rect') {
            const values = Na__PubMsMath__Values(measure);
            return values.Corners || [];
        }
        return measure.Points;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Point's Dot, or a Grip When the Measurement Is Selected
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Points(points, k, grips) {
        const r = (grips ? Na__LeVwMsOv__PX.Handle : Na__LeVwMsOv__PX.Dot) * k;
        const cls = grips ? 'na-le-viewer-ms__grip' : 'na-le-viewer-ms__dot';
        return points.map((p) => '<circle class="' + cls + '" cx="' + Na__LeVwMsOv__N(p.X) + '" cy="' + Na__LeVwMsOv__N(p.Y) + '" r="' + Na__LeVwMsOv__N(r) + '"' +
                                 (grips ? ' stroke-width="' + Na__LeVwMsOv__N(1.5 * k) + '"' : '') + '/>').join('');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Length
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Linear(measure, k, opts) {
        const pts = measure.Points;
        if (pts.length < 2) return { Markup : '', Boxes : [] };
        const a = pts[0], b = pts[1];
        const dx = b.X - a.X, dy = b.Y - a.Y, len = Math.hypot(dx, dy) || 1;
        const tx = (-dy / len) * Na__LeVwMsOv__PX.Tick * k, ty = (dx / len) * Na__LeVwMsOv__PX.Tick * k;
        const values = Na__PubMsMath__Values(measure);
        const label  = Na__LeVwMsOv__AlongLabel(Na__PubMsMath__FormatLength(values.Length, measure.Scale, values.Exact), a, b, Na__LeVwMsOv__PX.Label * k, k, null, null);
        let markup =
            '<path class="na-le-viewer-ms__line" d="M' + Na__LeVwMsOv__N(a.X) + ' ' + Na__LeVwMsOv__N(a.Y) + 'L' + Na__LeVwMsOv__N(b.X) + ' ' + Na__LeVwMsOv__N(b.Y) +
            'M' + Na__LeVwMsOv__N(a.X - tx) + ' ' + Na__LeVwMsOv__N(a.Y - ty) + 'L' + Na__LeVwMsOv__N(a.X + tx) + ' ' + Na__LeVwMsOv__N(a.Y + ty) +
            'M' + Na__LeVwMsOv__N(b.X - tx) + ' ' + Na__LeVwMsOv__N(b.Y - ty) + 'L' + Na__LeVwMsOv__N(b.X + tx) + ' ' + Na__LeVwMsOv__N(b.Y + ty) + '"' +
            ' stroke-width="' + Na__LeVwMsOv__N(Na__LeVwMsOv__PX.Line * k) + '"/>' +
            label.Markup;
        markup += Na__LeVwMsOv__Points(opts.grips ? pts : [], k, true);
        return { Markup : markup, Boxes : [ label.Box ], Main : label.Box };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Rectangle
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Rect(measure, k, opts) {
        const values = Na__PubMsMath__Values(measure);
        if (!values.Corners) return { Markup : '', Boxes : [] };
        const c = values.Corners;
        const centre = { X : (c[0].X + c[2].X) / 2, Y : (c[0].Y + c[2].Y) / 2 };
        const exact = values.Exact;
        const scale = measure.Scale;
        // WIDTH on whichever of its two edges is higher on the screen, HEIGHT on
        // whichever of its two is further right: outside the shape, like a dimension.
        const edgesW = [ [ c[0], c[1] ], [ c[3], c[2] ] ];
        const edgesH = [ [ c[1], c[2] ], [ c[0], c[3] ] ];
        const mid = (e) => ({ X : (e[0].X + e[1].X) / 2, Y : (e[0].Y + e[1].Y) / 2 });
        const top   = edgesW.slice().sort((p, q) => mid(p).Y - mid(q).Y)[0];
        const right = edgesH.slice().sort((p, q) => mid(q).X - mid(p).X)[0];
        const small = Na__LeVwMsOv__PX.Label * k;
        const w = Na__LeVwMsOv__AlongLabel(Na__PubMsMath__FormatLength(values.Width, scale, exact), top[0], top[1], small, k, centre, null);
        const h = Na__LeVwMsOv__AlongLabel(Na__PubMsMath__FormatLength(values.Height, scale, exact), right[0], right[1], small, k, centre, null);
        const area = Na__LeVwMsOv__Label(Na__PubMsMath__FormatArea(values.Area, exact), centre.X, centre.Y, Na__LeVwMsOv__PX.AreaLabel * k, 0, k, 'na-le-viewer-ms__label--area');
        const d = 'M' + c.map((p) => Na__LeVwMsOv__N(p.X) + ' ' + Na__LeVwMsOv__N(p.Y)).join('L') + 'Z';
        let markup = '<path class="na-le-viewer-ms__shape" d="' + d + '" stroke-width="' + Na__LeVwMsOv__N(Na__LeVwMsOv__PX.Line * k) + '"/>' +
                     w.Markup + h.Markup + area.Markup;
        markup += Na__LeVwMsOv__Points(opts.grips ? c : [], k, true);
        return { Markup : markup, Boxes : [ w.Box, h.Box, area.Box ], Main : area.Box };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Area (closed), or One Being Drawn (open)
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Area(measure, k, opts) {
        const pts = measure.Points;
        if (pts.length === 0) return { Markup : '', Boxes : [] };
        const closed = !opts.open && pts.length >= 3;
        const d = 'M' + pts.map((p) => Na__LeVwMsOv__N(p.X) + ' ' + Na__LeVwMsOv__N(p.Y)).join('L') + (closed ? 'Z' : '');
        let markup = '<path class="na-le-viewer-ms__shape' + (closed ? '' : ' na-le-viewer-ms__shape--open') + '" d="' + d + '" stroke-width="' + Na__LeVwMsOv__N(Na__LeVwMsOv__PX.Line * k) + '"/>';
        const boxes = [];
        let main = null;
        const values = Na__PubMsMath__Values(measure);
        if (closed) {
            const at = Na__PubMsMath__LabelPoint(pts);
            const size = Na__LeVwMsOv__PX.AreaLabel * k;
            const area = Na__LeVwMsOv__Label(Na__PubMsMath__FormatArea(values.Area, values.Exact), at.X, at.Y, size, 0, k, 'na-le-viewer-ms__label--area');
            const per  = Na__LeVwMsOv__Label('Perimeter ' + Na__PubMsMath__FormatLength(values.Perimeter, measure.Scale, values.Exact),
                                             at.X, at.Y + size * 1.15, Na__LeVwMsOv__PX.Small * k, 0, k, 'na-le-viewer-ms__label--small');
            markup += area.Markup + per.Markup;
            boxes.push(area.Box, per.Box);
            main = area.Box;
        }
        // EACH SIDE'S LENGTH, while it is being drawn or once it is selected: on
        // every area at once they would bury the drawing.
        if (opts.sides && pts.length >= 2) {
            const centre = closed ? Na__PubMsMath__LabelPoint(pts) : null;
            const count = closed ? pts.length : pts.length - 1;
            for (let i = 0; i < count; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length];
                const side = Na__PubMsMath__Values({ Tool : 'linear', Scale : measure.Scale, Points : [ a, b ] });
                const label = Na__LeVwMsOv__AlongLabel(Na__PubMsMath__FormatLength(side.Length, measure.Scale, side.Exact), a, b, Na__LeVwMsOv__PX.Small * k, k, centre, 'na-le-viewer-ms__label--small');
                markup += label.Markup;
                boxes.push(label.Box);
            }
        }
        markup += Na__LeVwMsOv__Points(pts, k, !!opts.grips);
        return { Markup : markup, Boxes : boxes, Main : main };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Measurement, Whichever Kind
    // ------------------------------------------------------------
    function Na__LeVwMsOv__One(measure, k, opts) {
        if (measure.Tool === 'linear') return Na__LeVwMsOv__Linear(measure, k, opts);
        if (measure.Tool === 'rect')   return Na__LeVwMsOv__Rect(measure, k, opts);
        if (measure.Tool === 'area')   return Na__LeVwMsOv__Area(measure, k, opts);
        return { Markup : '', Boxes : [] };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Snap
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Editor's Glyph, Sized and Placed on the Overlay (empty if it cannot be)
    // ------------------------------------------------------------
    // Na__LeOsnap__GlyphSvg hands out a whole <svg> sized 100% by 100%. Here it
    // becomes a nested <svg> placed at the point; if that module ever writes
    // its size differently, the glyph is left out rather than filling the sheet.
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Glyph(kind, x, y, k) {
        const glyph = Na__LeVwMsOv__GLYPH[kind];
        if (!glyph) return '';
        const size = Na__LeVwMsOv__PX.Glyph * k;
        const markup = Na__LeOsnap__GlyphSvg(glyph);
        const sized = markup.replace('width="100%" height="100%"',
            'x="' + Na__LeVwMsOv__N(x - size / 2) + '" y="' + Na__LeVwMsOv__N(y - size / 2) + '" width="' + Na__LeVwMsOv__N(size) + '" height="' + Na__LeVwMsOv__N(size) + '" overflow="visible"');
        if (sized === markup) return '';
        return '<g class="na-le-osnap--' + glyph + '">' + sized + '</g>';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Snap Marker, Its Name and the Square Off the Last Point
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Marker(marker, name, k) {
        if (!marker || marker.Kind === 'none') return '';
        let markup = '';
        const axisClass = marker.Axis === 'v' ? ' na-le-viewer-ms__marker--v' : (marker.Axis === 'h' ? ' na-le-viewer-ms__marker--h' : '');
        if (marker.Guide) {
            const g = marker.Guide;
            const dx = g.X2 - g.X1, dy = g.Y2 - g.Y1, len = Math.hypot(dx, dy) || 1;
            const run = Na__LeVwMsOv__PX.GuideRun * k;
            markup += '<path class="na-le-viewer-ms__guide' + axisClass + '" d="M' + Na__LeVwMsOv__N(g.X1) + ' ' + Na__LeVwMsOv__N(g.Y1) +
                      'L' + Na__LeVwMsOv__N(g.X2 + dx / len * run) + ' ' + Na__LeVwMsOv__N(g.Y2 + dy / len * run) + '"' +
                      ' stroke-width="' + Na__LeVwMsOv__N(Na__LeVwMsOv__PX.Guide * k) + '" stroke-dasharray="' + Na__LeVwMsOv__N(5 * k) + ' ' + Na__LeVwMsOv__N(4 * k) + '"/>';
        }
        markup += '<g class="na-le-viewer-ms__marker' + axisClass + '">' + Na__LeVwMsOv__Glyph(marker.Kind, marker.X, marker.Y, k) + '</g>';
        if (name) {
            const size = Na__LeVwMsOv__PX.Name * k;
            const width = Na__LeVwMsOv__TextWidth(name, size) + 12 * k;
            const clear = (Na__LeVwMsOv__PX.Glyph / 2 + 3) * k;                  // <-- Below and right of the glyph, clear of it
            const x = marker.X + clear, y = marker.Y + clear;
            markup += '<g class="na-le-viewer-ms__name"><rect x="' + Na__LeVwMsOv__N(x) + '" y="' + Na__LeVwMsOv__N(y) + '" width="' + Na__LeVwMsOv__N(width) + '" height="' + Na__LeVwMsOv__N(size * 1.55) + '" rx="' + Na__LeVwMsOv__N(3 * k) + '"/>' +
                      '<text x="' + Na__LeVwMsOv__N(x + 6 * k) + '" y="' + Na__LeVwMsOv__N(y + size * 0.78) + '" font-size="' + Na__LeVwMsOv__N(size) + '">' + Na__LeVwMsOv__Esc(name) + '</text></g>';
        }
        return markup;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Put the Overlay on the Paper (once), Sized to the Sheet
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Ensure(paper) {
        if (!paper) return null;
        const layout = Na__LeSurface__GetLayout();
        const page = layout && layout.Page;
        if (!page) return null;
        let svg = paper.querySelector(':scope > svg.' + Na__LeVwMsOv__CLASS);
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', Na__LeVwMsOv__CLASS);
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
            svg.setAttribute('preserveAspectRatio', 'none');
            paper.appendChild(svg);                                              // <-- After the published host: over the drawing
        } else if (svg !== paper.lastElementChild) {
            paper.appendChild(svg);                                              // <-- Something was added since: stay on top
        }
        svg.setAttribute('viewBox', '0 0 ' + Na__LeVwMsOv__N(page.WidthMm) + ' ' + Na__LeVwMsOv__N(page.HeightMm));
        Na__LeVwMsOv__Svg = svg;
        return svg;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Overlay Off the Paper
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Remove() {
        if (Na__LeVwMsOv__Svg && Na__LeVwMsOv__Svg.parentNode) Na__LeVwMsOv__Svg.parentNode.removeChild(Na__LeVwMsOv__Svg);
        Na__LeVwMsOv__Svg = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw Everything, and Say Where the Labels and the Delete Chip Landed
    // ------------------------------------------------------------
    // scene : {
    //   Measures   - the sheet's measurements (oldest first)
    //   SelectedId - the one with grips, its sides and a delete chip
    //   HoverId    - the one under the mouse
    //   Draft      - the measurement being made, or null
    //   Cursor     - where the next point would land { X, Y }, or null
    //   Marker     - the snap found { Kind, X, Y, Axis, Guide }, or null
    //   MarkerName - its name beside it (a mouse; a finger hides it), or null
    // }
    // Returns { Labels : [ { Id, Box } ], Chip : { Id, X, Y, R } | null } in mm.
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Render(scene) {
        const svg = Na__LeVwMsOv__Svg;
        const hits = { Labels : [], Chip : null };
        if (!svg) return hits;
        const k  = Na__LeVwMsOv__MmPerPx();                                     // <-- The snap marker: its own size
        const kd = k * Na__LeVwMsOv__Size;                                       // <-- The dimensions: at the reader's size
        const parts = [];

        for (const measure of (scene.Measures || [])) {
            const selected = measure.Id === scene.SelectedId;
            const drawn = Na__LeVwMsOv__One(measure, kd, { grips : selected, sides : selected });
            const cls = 'na-le-viewer-ms__measure' + (selected ? ' na-le-viewer-ms__measure--selected' : '') + (measure.Id === scene.HoverId ? ' na-le-viewer-ms__measure--hover' : '');
            let markup = drawn.Markup;
            if (selected && drawn.Main) {
                const chip = Na__LeVwMsOv__Chip(drawn.Main, kd);
                markup += chip.Markup;
                hits.Chip = { Id : measure.Id, X : chip.Hit.X, Y : chip.Hit.Y, R : chip.Hit.R };
            }
            parts.push('<g class="' + cls + '" data-na-ms-id="' + Na__LeVwMsOv__Esc(measure.Id) + '">' + markup + '</g>');
            drawn.Boxes.forEach((box) => hits.Labels.push({ Id : measure.Id, Box : box }));
        }

        // THE ONE BEING MADE: its points so far, and on to the cursor.
        const draft = scene.Draft;
        if (draft && Array.isArray(draft.Points) && draft.Points.length) {
            const live = Object.assign({}, draft, { Points : draft.Points.slice() });
            const cursor = scene.Cursor;
            const waiting = (draft.Tool === 'area') || draft.Points.length < 2;
            if (cursor && waiting) live.Points.push({ X : cursor.X, Y : cursor.Y, Snap : cursor.Kind || 'none' });
            const drawn = Na__LeVwMsOv__One(live, kd, { grips : false, sides : true, open : draft.Tool === 'area' });
            let markup = drawn.Markup;
            if (draft.Tool === 'area' && live.Points.length >= 3) {                // <-- The closing side, faint, so the shape reads before it is closed
                const a = live.Points[live.Points.length - 1], b = live.Points[0];
                markup += '<path class="na-le-viewer-ms__closing" d="M' + Na__LeVwMsOv__N(a.X) + ' ' + Na__LeVwMsOv__N(a.Y) + 'L' + Na__LeVwMsOv__N(b.X) + ' ' + Na__LeVwMsOv__N(b.Y) + '"' +
                          ' stroke-width="' + Na__LeVwMsOv__N(Na__LeVwMsOv__PX.Line * kd) + '" stroke-dasharray="' + Na__LeVwMsOv__N(4 * kd) + ' ' + Na__LeVwMsOv__N(4 * kd) + '"/>';
                const values = Na__PubMsMath__Values(live);
                const at = Na__PubMsMath__LabelPoint(live.Points);
                markup += Na__LeVwMsOv__Label(Na__PubMsMath__FormatArea(values.Area, values.Exact), at.X, at.Y, Na__LeVwMsOv__PX.AreaLabel * kd, 0, kd, 'na-le-viewer-ms__label--area').Markup;
            }
            parts.push('<g class="na-le-viewer-ms__measure na-le-viewer-ms__measure--draft">' + markup + Na__LeVwMsOv__Points(draft.Points, kd, false) + '</g>');
        }

        parts.push(Na__LeVwMsOv__Marker(scene.Marker, scene.MarkerName, k));
        svg.innerHTML = parts.join('');
        return hits;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Points a Measurement Is Pulled By (for the tools' hit-test)
    // ------------------------------------------------------------
    function Na__LeVwMsOv__Grips(measure) {
        return Na__LeVwMsOv__GripPoints(measure);
    }
    // ------------------------------------------------------------


    // FUNCTION | How Big a Grip Is Drawn, in Screen Pixels (its radius, at the reader's size)
    // ------------------------------------------------------------
    function Na__LeVwMsOv__GripPx() {
        return Na__LeVwMsOv__PX.Handle * Na__LeVwMsOv__Size;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Reader's Dimension Size (a factor, held to SIZE.Min..Max); returns the size set
    // ------------------------------------------------------------
    // The caller redraws.
    // ------------------------------------------------------------
    function Na__LeVwMsOv__SetSize(factor) {
        const n = Number(factor);
        Na__LeVwMsOv__Size = Number.isFinite(n) ? Math.max(Na__LeVwMsOv__SIZE.Min, Math.min(Na__LeVwMsOv__SIZE.Max, n)) : Na__LeVwMsOv__SIZE.Default;
        return Na__LeVwMsOv__Size;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Reader's Dimension Size
    // ------------------------------------------------------------
    function Na__LeVwMsOv__GetSize() {
        return Na__LeVwMsOv__Size;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__LeVwMsOv__SIZE,
        Na__LeVwMsOv__Ensure,
        Na__LeVwMsOv__Remove,
        Na__LeVwMsOv__Render,
        Na__LeVwMsOv__MmPerPx,
        Na__LeVwMsOv__Grips,
        Na__LeVwMsOv__GripPx,
        Na__LeVwMsOv__SetSize,
        Na__LeVwMsOv__GetSize
    };

// endregion -------------------------------------------------------------------
