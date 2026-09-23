// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - SVG PRIMITIVES
// =============================================================================
//
// FILE       : Na__PubDoc__Paint__.js
// NAMESPACE  : Na__PubPaint
// MODULE     : Published Documents - Svg Primitives
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Emit the handful of SVG primitives a published drawing is made of, as markup, and nothing more
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - MARKUP, NOT NODES, and that is the whole performance story of the reader. A
//   sheet is built as one string and handed to the parser once. Building it as
//   DOM would mean thousands of createElementNS calls, each one a JS/DOM
//   boundary crossing, on the device least able to afford them. Interaction
//   comes afterwards from ONE delegated listener reading data-na-id, so nothing
//   is lost by not holding a node per element.
// - IT MEASURES NOTHING, WRAPS NOTHING, FORMATS NOTHING. There is no text
//   metric, no line breaking, no number formatting and no unit conversion in
//   this file, because a published document carries its text already broken into
//   lines and its dimensions already rendered as strings. That is the property
//   that makes the reader small: every decision was made at publish time, by the
//   authoring side, using the same code that drew the drawing Adam approved.
// - EVERY COORDINATE IS PAPER MILLIMETRES. The sheet's <svg> carries a viewBox
//   in millimetres, so a number in a published file is written straight out with
//   no scaling. Zoom is a transform on a wrapper, never a re-emit.
// - LINEWEIGHTS ARE POINTS IN THE DATA AND MILLIMETRES IN THE OUTPUT, converted
//   in exactly one place here, because a stroke width in the wrong unit is a
//   drawing that looks nearly right.
//
// INTEGRATION:
// - Na__PubDoc__Elements__, Na__PubDoc__Sheet__, Na__PubDoc__Viewports__ and
//   Na__PubDoc__Unpublished__ all paint through this and hold no markup of their
//   own.
// - No imports. This file is a leaf on purpose: it is the one part of the reader
//   that can be tested with nothing loaded at all.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with Phase 2 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    const Na__PubPaint__MM_PER_PT = 0.352777778;                                  // <-- One point is 1/72 inch
    const Na__PubPaint__DECIMALS  = 4;                                            // <-- Paper millimetres; a ten-thousandth of a mm is far past any printer

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Values
// -----------------------------------------------------------------------------

    // FUNCTION | A Number as Short Attribute Text
    // ------------------------------------------------------------
    // Trailing zeros are dropped because a sheet holds tens of thousands of
    // these and the string is parsed on a phone. A value that is not a finite
    // number becomes 0 rather than "NaN", which SVG would silently ignore and
    // which is far harder to see than a mark in the wrong place.
    // ------------------------------------------------------------
    function Na__PubPaint__Num(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '0';
        const fixed = number.toFixed(Na__PubPaint__DECIMALS);
        return fixed.indexOf('.') === -1 ? fixed : fixed.replace(/\.?0+$/, '');
    }
    // ------------------------------------------------------------


    // FUNCTION | Points to Paper Millimetres
    // ------------------------------------------------------------
    function Na__PubPaint__PtToMm(points) {
        const number = Number(points);
        return Number.isFinite(number) ? (number * Na__PubPaint__MM_PER_PT) : 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Text Safe Inside an Attribute or an Element
    // ------------------------------------------------------------
    // Client text reaches this file: a site address, a specification note, a
    // room name somebody typed. An unescaped ampersand makes the whole sheet
    // fail to parse, and one unescaped angle bracket would let a document inject
    // markup into the page that shows it.
    // ------------------------------------------------------------
    function Na__PubPaint__Esc(text) {
        if (text == null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Attribute, or Nothing When the Value Is Absent
    // ------------------------------------------------------------
    function Na__PubPaint__Attr(name, value) {
        return (value == null || value === '') ? '' : (' ' + name + '="' + Na__PubPaint__Esc(value) + '"');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Stroke Attributes Shared by Every Line and Outline
    // ------------------------------------------------------------
    function Na__PubPaint__Stroke(colour, pt, opacity, style) {
        if (!colour) return ' stroke="none"';
        let out = ' stroke="' + Na__PubPaint__Esc(colour) + '"' +
                  ' stroke-width="' + Na__PubPaint__Num(Na__PubPaint__PtToMm(pt)) + '"';
        if (opacity != null && Number(opacity) < 1) out += ' stroke-opacity="' + Na__PubPaint__Num(opacity) + '"';
        const dash = Na__PubPaint__Dash(style, pt);
        if (dash) out += ' stroke-dasharray="' + dash + '"';
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Dash Pattern for a Published Line Style
    // ------------------------------------------------------------
    // The styles a published vector can carry, scaled off the line's own weight
    // so a hairline dash does not read as a solid line. "centre" is the CAD
    // long-short chain the GFFL datum uses.
    // ------------------------------------------------------------
    function Na__PubPaint__Dash(style, pt) {
        if (!style || style === 'solid') return '';
        const w = Math.max(0.08, Na__PubPaint__PtToMm(pt));
        const n = Na__PubPaint__Num;
        switch (String(style)) {
            case 'dashed' : return n(w * 6) + ' ' + n(w * 4);
            case 'dotted' : return n(w * 1) + ' ' + n(w * 3);
            case 'centre' :
            case 'center' : return n(w * 12) + ' ' + n(w * 3) + ' ' + n(w * 3) + ' ' + n(w * 3);
            case 'hidden' : return n(w * 4) + ' ' + n(w * 4);
            default       : return '';
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Fill Attributes
    // ------------------------------------------------------------
    function Na__PubPaint__Fill(colour, opacity, patternId) {
        if (patternId) return ' fill="url(#' + Na__PubPaint__Esc(patternId) + ')"';
        if (!colour) return ' fill="none"';
        let out = ' fill="' + Na__PubPaint__Esc(colour) + '"';
        if (opacity != null && Number(opacity) < 1) out += ' fill-opacity="' + Na__PubPaint__Num(opacity) + '"';
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Primitives
// -----------------------------------------------------------------------------
//
// Each one takes a sink - a plain array - and pushes one element's markup onto
// it. An array is used rather than string concatenation because a sheet is built
// from thousands of pieces and one join at the end is the cheap way to do that.
//
// -----------------------------------------------------------------------------

    // FUNCTION | A New Sink
    // ------------------------------------------------------------
    function Na__PubPaint__Sink() {
        return [];
    }
    // ------------------------------------------------------------


    // FUNCTION | Everything in a Sink, as One String
    // ------------------------------------------------------------
    function Na__PubPaint__Done(sink) {
        return sink.join('');
    }
    // ------------------------------------------------------------


    // FUNCTION | Open a Group
    // ------------------------------------------------------------
    // id and kind become data-na-id and data-na-kind, which is how the one
    // delegated listener on the sheet finds out what was tapped.
    // ------------------------------------------------------------
    function Na__PubPaint__Group(sink, options) {
        const o = options || {};
        sink.push('<g' +
            Na__PubPaint__Attr('class', o.Class) +
            Na__PubPaint__Attr('data-na-id', o.Id) +
            Na__PubPaint__Attr('data-na-kind', o.Kind) +
            Na__PubPaint__Attr('data-na-layer', o.LayerId) +
            Na__PubPaint__Attr('transform', o.Transform) +
            (o.Opacity != null && Number(o.Opacity) < 1 ? ' opacity="' + Na__PubPaint__Num(o.Opacity) + '"' : '') +
            '>');
        return sink;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close a Group
    // ------------------------------------------------------------
    function Na__PubPaint__GroupEnd(sink) {
        sink.push('</g>');
        return sink;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Rectangle
    // ------------------------------------------------------------
    function Na__PubPaint__Rect(sink, x, y, width, height, style) {
        const s = style || {};
        sink.push('<rect x="' + Na__PubPaint__Num(x) + '" y="' + Na__PubPaint__Num(y) +
            '" width="' + Na__PubPaint__Num(Math.max(0, width)) + '" height="' + Na__PubPaint__Num(Math.max(0, height)) + '"' +
            Na__PubPaint__Fill(s.FillColour, s.FillOpacity, s.PatternId) +
            Na__PubPaint__Stroke(s.StrokeColour, s.StrokePt, s.StrokeOpacity, s.LineStyle) +
            Na__PubPaint__Attr('class', s.Class) +
            Na__PubPaint__Attr('data-na-id', s.Id) +
            '/>');
        return sink;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Straight Line
    // ------------------------------------------------------------
    function Na__PubPaint__Line(sink, x1, y1, x2, y2, style) {
        const s = style || {};
        sink.push('<line x1="' + Na__PubPaint__Num(x1) + '" y1="' + Na__PubPaint__Num(y1) +
            '" x2="' + Na__PubPaint__Num(x2) + '" y2="' + Na__PubPaint__Num(y2) + '"' +
            Na__PubPaint__Stroke(s.StrokeColour, s.StrokePt, s.StrokeOpacity, s.LineStyle) +
            ' stroke-linecap="' + (s.Cap || 'round') + '"' +
            Na__PubPaint__Attr('class', s.Class) +
            '/>');
        return sink;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Circle
    // ------------------------------------------------------------
    function Na__PubPaint__Circle(sink, cx, cy, radius, style) {
        const s = style || {};
        sink.push('<circle cx="' + Na__PubPaint__Num(cx) + '" cy="' + Na__PubPaint__Num(cy) +
            '" r="' + Na__PubPaint__Num(Math.max(0, radius)) + '"' +
            Na__PubPaint__Fill(s.FillColour, s.FillOpacity, s.PatternId) +
            Na__PubPaint__Stroke(s.StrokeColour, s.StrokePt, s.StrokeOpacity, s.LineStyle) +
            Na__PubPaint__Attr('class', s.Class) +
            '/>');
        return sink;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Polyline or Polygon From [ [x,y], ... ]
    // ------------------------------------------------------------
    // Points are emitted as a path rather than a <polyline> so an open and a
    // closed shape are the same element and a holed polygon can add rings later
    // without changing the element type.
    // ------------------------------------------------------------
    function Na__PubPaint__Points(sink, points, closed, style) {
        if (!Array.isArray(points) || points.length === 0) return sink;
        const s = style || {};
        let d = '';
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (!Array.isArray(point) || point.length < 2) continue;
            d += (d === '' ? 'M' : 'L') + Na__PubPaint__Num(point[0]) + ',' + Na__PubPaint__Num(point[1]);
        }
        if (d === '') return sink;
        if (closed) d += 'Z';
        return Na__PubPaint__Path(sink, d, style);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Path From Its Own d
    // ------------------------------------------------------------
    function Na__PubPaint__Path(sink, d, style) {
        if (typeof d !== 'string' || d === '') return sink;
        const s = style || {};
        sink.push('<path d="' + d + '"' +
            Na__PubPaint__Fill(s.FillColour, s.FillOpacity, s.PatternId) +
            Na__PubPaint__Stroke(s.StrokeColour, s.StrokePt, s.StrokeOpacity, s.LineStyle) +
            ' stroke-linecap="' + (s.Cap || 'round') + '" stroke-linejoin="' + (s.Join || 'round') + '"' +
            Na__PubPaint__Attr('class', s.Class) +
            Na__PubPaint__Attr('data-na-id', s.Id) +
            '/>');
        return sink;
    }
    // ------------------------------------------------------------


    // FUNCTION | Text, One Line or Several, Already Broken
    // ------------------------------------------------------------
    // lines is the published Annotation__Lines: the exact lines the drawing
    // prints, measured at publish. Nothing is wrapped here. runs, when present,
    // carries the per-line emphasis already resolved, so no markdown is parsed
    // on a client's device.
    // ------------------------------------------------------------
    function Na__PubPaint__Text(sink, x, y, lines, style) {
        const s     = style || {};
        const rows  = Array.isArray(lines) ? lines : [ lines ];
        if (rows.length === 0) return sink;
        const size  = Number(s.SizeMm) || 2.5;
        const lead  = (s.LeadingMm != null) ? Number(s.LeadingMm) : (size * 1.25);
        const anchor = (s.Align === 'centre' || s.Align === 'center') ? 'middle'
                     : (s.Align === 'right') ? 'end' : 'start';

        sink.push('<text x="' + Na__PubPaint__Num(x) + '" y="' + Na__PubPaint__Num(y) + '"' +
            ' font-size="' + Na__PubPaint__Num(size) + '"' +
            Na__PubPaint__Attr('font-family', s.FontFamily) +
            (s.FontWeight ? ' font-weight="' + Na__PubPaint__Num(s.FontWeight) + '"' : '') +
            ' fill="' + Na__PubPaint__Esc(s.Colour || '#172b3a') + '"' +
            (s.Opacity != null && Number(s.Opacity) < 1 ? ' fill-opacity="' + Na__PubPaint__Num(s.Opacity) + '"' : '') +
            ' text-anchor="' + anchor + '"' +
            (s.Baseline ? ' dominant-baseline="' + Na__PubPaint__Esc(s.Baseline) + '"' : '') +
            ' xml:space="preserve"' +
            Na__PubPaint__Attr('class', s.Class) +
            Na__PubPaint__Attr('data-na-id', s.Id) +
            (s.Rotation ? ' transform="rotate(' + Na__PubPaint__Num(s.Rotation) + ' ' +
                          Na__PubPaint__Num(x) + ' ' + Na__PubPaint__Num(y) + ')"' : '') +
            '>');

        for (let i = 0; i < rows.length; i++) {
            const dy   = (i === 0) ? 0 : lead;
            const runs = (Array.isArray(s.Runs) && Array.isArray(s.Runs[i])) ? s.Runs[i] : null;
            sink.push('<tspan x="' + Na__PubPaint__Num(x) + '"' +
                      (i === 0 ? '' : ' dy="' + Na__PubPaint__Num(dy) + '"') + '>');
            if (runs) {
                for (const run of runs) {
                    const weight = run['Run__Weight'];
                    sink.push('<tspan' + (weight ? ' font-weight="' + Na__PubPaint__Num(weight) + '"' : '') + '>' +
                              Na__PubPaint__Esc(run['Run__Text']) + '</tspan>');
                }
            } else {
                sink.push(Na__PubPaint__Esc(rows[i]));
            }
            sink.push('</tspan>');
        }
        sink.push('</text>');
        return sink;
    }
    // ------------------------------------------------------------


    // FUNCTION | An Image
    // ------------------------------------------------------------
    // preserveAspectRatio is "none" because the published rectangle IS the part
    // of the picture that shows: the crop was applied when the picture was
    // stored, so the browser must not letterbox it back.
    // ------------------------------------------------------------
    function Na__PubPaint__Image(sink, x, y, width, height, href, style) {
        if (!href) return sink;
        const s = style || {};
        sink.push('<image x="' + Na__PubPaint__Num(x) + '" y="' + Na__PubPaint__Num(y) +
            '" width="' + Na__PubPaint__Num(Math.max(0, width)) + '" height="' + Na__PubPaint__Num(Math.max(0, height)) + '"' +
            ' href="' + Na__PubPaint__Esc(href) + '"' +
            ' preserveAspectRatio="' + (s.Aspect || 'none') + '"' +
            (s.Opacity != null && Number(s.Opacity) < 1 ? ' opacity="' + Na__PubPaint__Num(s.Opacity) + '"' : '') +
            Na__PubPaint__Attr('class', s.Class) +
            Na__PubPaint__Attr('data-na-id', s.Id) +
            Na__PubPaint__Attr('clip-path', s.ClipPath ? ('url(#' + s.ClipPath + ')') : null) +
            '/>');
        return sink;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Definitions - Gradients, Patterns and Clips
// -----------------------------------------------------------------------------
//
// A published gradient or hatch is published as the RULE it is, not baked into a
// raster, because an SVG paint server is one paint the browser already knows how
// to do and baking it would force the viewport picture to carry an alpha
// channel - which is exactly the layered-transparency shape this whole system
// exists to stop shipping to phones.
//
// -----------------------------------------------------------------------------

    // FUNCTION | A Linear Gradient Definition
    // ------------------------------------------------------------
    function Na__PubPaint__Gradient(sink, id, gradient) {
        if (!gradient || !Array.isArray(gradient['Gradient__Stops'])) return null;
        const angle = Number(gradient['Gradient__AngleDeg']) || 0;
        const rad   = (angle - 90) * Math.PI / 180;                               // <-- 0 deg points up the sheet, as the gradient tool means it
        const x1 = 0.5 - Math.cos(rad) * 0.5, y1 = 0.5 - Math.sin(rad) * 0.5;
        const x2 = 0.5 + Math.cos(rad) * 0.5, y2 = 0.5 + Math.sin(rad) * 0.5;

        sink.push('<linearGradient id="' + Na__PubPaint__Esc(id) + '"' +
            ' x1="' + Na__PubPaint__Num(x1) + '" y1="' + Na__PubPaint__Num(y1) +
            '" x2="' + Na__PubPaint__Num(x2) + '" y2="' + Na__PubPaint__Num(y2) + '">');
        for (const stop of gradient['Gradient__Stops']) {
            sink.push('<stop offset="' + Na__PubPaint__Num(stop['Stop__At']) + '"' +
                ' stop-color="' + Na__PubPaint__Esc(stop['Stop__Colour'] || '#ffffff') + '"' +
                ' stop-opacity="' + Na__PubPaint__Num(stop['Stop__Opacity'] == null ? 1 : stop['Stop__Opacity']) + '"/>');
        }
        sink.push('</linearGradient>');
        return id;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Hatch Pattern Definition Wrapping a Shared Tile
    // ------------------------------------------------------------
    // The tile is published once per project and referenced by every shape that
    // uses it, so a plan with forty hatched walls downloads one tile and paints
    // one pattern per shape however large the area.
    // ------------------------------------------------------------
    function Na__PubPaint__HatchPattern(sink, id, hatch, tileHref) {
        if (!hatch || !tileHref) return null;
        const size  = Math.max(0.1, Number(hatch['Hatch__ScaleMm']) || 4);
        const angle = Number(hatch['Hatch__AngleDeg']) || 0;
        sink.push('<pattern id="' + Na__PubPaint__Esc(id) + '" width="' + Na__PubPaint__Num(size) +
            '" height="' + Na__PubPaint__Num(size) + '" patternUnits="userSpaceOnUse"' +
            (angle ? ' patternTransform="rotate(' + Na__PubPaint__Num(angle) + ')"' : '') + '>');
        Na__PubPaint__Image(sink, 0, 0, size, size, tileHref, { Aspect : 'none' });
        sink.push('</pattern>');
        return id;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Soft Drop Shadow Filter
    // ------------------------------------------------------------
    function Na__PubPaint__ShadowFilter(sink, id, options) {
        const o = options || {};
        const blur = Number(o.BlurMm) || 1.6;
        sink.push('<filter id="' + Na__PubPaint__Esc(id) + '" x="-20%" y="-20%" width="140%" height="140%">' +
            '<feDropShadow dx="' + Na__PubPaint__Num(o.OffsetXMm || 0) + '" dy="' + Na__PubPaint__Num(o.OffsetYMm || 0) +
            '" stdDeviation="' + Na__PubPaint__Num(blur) + '"' +
            ' flood-color="' + Na__PubPaint__Esc(o.Colour || '#1f1d18') + '"' +
            ' flood-opacity="' + Na__PubPaint__Num(o.Opacity == null ? 0.3 : o.Opacity) + '"/></filter>');
        return id;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Rectangular Clip Path
    // ------------------------------------------------------------
    function Na__PubPaint__ClipRect(sink, id, x, y, width, height) {
        sink.push('<clipPath id="' + Na__PubPaint__Esc(id) + '"><rect x="' + Na__PubPaint__Num(x) +
            '" y="' + Na__PubPaint__Num(y) + '" width="' + Na__PubPaint__Num(Math.max(0, width)) +
            '" height="' + Na__PubPaint__Num(Math.max(0, height)) + '"/></clipPath>');
        return id;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sheet Wrapper
// -----------------------------------------------------------------------------

    // FUNCTION | Wrap a Body in the Sheet's Own Svg, in Paper Millimetres
    // ------------------------------------------------------------
    // THE VIEWBOX IS THE PAPER, IN MILLIMETRES. Every published number is then
    // written out unscaled, and fitting the sheet to a screen is the browser
    // scaling one element rather than the reader recomputing anything.
    // ------------------------------------------------------------
    function Na__PubPaint__Svg(widthMm, heightMm, defs, body, options) {
        const o = options || {};
        return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"' +
            ' viewBox="0 0 ' + Na__PubPaint__Num(widthMm) + ' ' + Na__PubPaint__Num(heightMm) + '"' +
            ' width="100%" height="100%" preserveAspectRatio="xMidYMid meet"' +
            Na__PubPaint__Attr('class', o.Class) +
            Na__PubPaint__Attr('data-na-document', o.DocumentId) +
            ' font-family="' + Na__PubPaint__Esc(o.FontFamily || 'system-ui, sans-serif') + '">' +
            (defs ? ('<defs>' + defs + '</defs>') : '') +
            body +
            '</svg>';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubPaint__Num,
        Na__PubPaint__PtToMm,
        Na__PubPaint__Esc,
        Na__PubPaint__Sink,
        Na__PubPaint__Done,
        Na__PubPaint__Group,
        Na__PubPaint__GroupEnd,
        Na__PubPaint__Rect,
        Na__PubPaint__Line,
        Na__PubPaint__Circle,
        Na__PubPaint__Points,
        Na__PubPaint__Path,
        Na__PubPaint__Text,
        Na__PubPaint__Image,
        Na__PubPaint__Gradient,
        Na__PubPaint__HatchPattern,
        Na__PubPaint__ShadowFilter,
        Na__PubPaint__ClipRect,
        Na__PubPaint__Svg
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
