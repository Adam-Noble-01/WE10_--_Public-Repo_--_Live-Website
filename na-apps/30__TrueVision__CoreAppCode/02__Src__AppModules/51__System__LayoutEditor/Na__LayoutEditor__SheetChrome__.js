// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET CHROME
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetChrome__.js
// NAMESPACE  : Na__LeChrome
// MODULE     : Layout Editor - Sheet Chrome
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Describe everything printed on a sheet as primitives, and paint them to SVG or PDF
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - One flat list of paper-millimetre primitives (rect, line, polyline,
//   text, image, group) describes the sheet border, the viewport frames and
//   captions, the title block and the sheet markup. The screen renders the
//   list to an SVG overlay whose viewBox is the paper; the PDF exporter
//   draws the same list into jsPDF. There is nothing to keep in step by
//   hand: a change to the list changes both surfaces.
// - Text is measured through jsPDF's Helvetica metrics when the library has
//   loaded, so a value truncated on paper is truncated in the same place on
//   screen; before that an average-advance estimate keeps layouts sane.
// - A text run may carry TrackingMm, letter spacing in paper millimetres
//   rather than ems, because a PDF content stream sets character spacing in
//   the page unit. The SVG painter writes it as letter-spacing, the PDF
//   painter as jsPDF's charSpace, and the measurer counts it, so a tracked
//   caption runs out of its cell at the same character on both surfaces.
// - Image assets (the Vale logo, the classic title block scan) are loaded
//   once as data URLs and announced, so a sheet built before the asset
//   arrived can rebuild.
//
// INTEGRATION:
// - SheetSurface, MarkupBridge and PdfExporter build and render through it.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__SheetChrome__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.6.0
// - PDF: a turned text run that is centred or right-aligned is placed by its
//   own left end. jsPDF shifts such a run along the page's x axis and then
//   turns it about that shifted start, so a turned centred run printed half
//   its width away from where the screen draws it. The run's width is now
//   measured the way jsPDF aligns a line (its string width at the current
//   font, character spacing included), the start is walked back along the
//   turned baseline, and the run is drawn left-aligned. Turned sheet text
//   and the value of a vertical or aligned dimension print where the screen
//   draws them; level text is unchanged.
//
// 14-Sep-2026 - Version 1.5.0
// - A polyline primitive can carry a dash array (DashArray: paper millimetres)
//   as well as the older equal-dash DashMm. The SVG writes the array as
//   stroke-dasharray and the PDF as setLineDashPattern, so a centre line
//   (long-short-long) prints the same on both surfaces. DashMm still paints
//   an equal dash and gap, which every earlier caller - leaders, ghosts -
//   keeps using.
//
// 14-Sep-2026 - Version 1.4.0
// - A viewport whose Viewport__ShowFrame is false builds no frame and no
//   caption, so both leave the screen and the PDF together. Every record from
//   before the switch, and every new viewport, keeps its frame.
//
// 14-Sep-2026 - Version 1.3.0
// - A polyline primitive can carry a dash (DashMm) and an opacity for its fill
//   and for its edges (FillOpacity, StrokeOpacity), handed in through an
//   optional last argument of PushPolyline, so every existing caller paints
//   exactly as before. The SVG writes stroke-dasharray, fill-opacity and
//   stroke-opacity; the PDF sets the dash pattern and draws inside a graphics
//   state carrying the two opacities. Leaders use all three, vectors the
//   opacities.
//
// 13-Sep-2026 - Version 1.2.0
// - A polyline primitive can carry a Gradient (a Shape__Gradient record), and
//   both painters hand it to Na__LayoutEditor__GradientTool__. The SVG writes a
//   <linearGradient> and fills the path with it; the PDF paints in three passes -
//   any solid fill, the gradient clipped to the outline, then the edges on top.
//
// 10-Sep-2026 - Version 1.1.0
// - Letter spacing carried on a text primitive and honoured by both painters
//   and the measurer, which the title block labels and the frame captions now
//   use (Lantern's TrackingMm, back-ported).
// - Frame captions read their weight, tracking and uppercasing from the style
//   config instead of a hardcoded 600.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Scale and the Title Block Styles
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetStyleSetup,
        Na__LeCfg__GetSheetSetup
    } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeScale__FormatLabel } from './Na__LayoutEditor__ScaleManager__.js';
    import { Na__LeModel__ResolveViewportSource, Na__LeModel__IsLayerVisible, Na__LeModel__KIND_2D } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeTitleModern__Build }  from './Na__LayoutEditor__TitleBlock__Modern__.js';
    import { Na__LeTitleClassic__Build } from './Na__LayoutEditor__TitleBlock__Classic__.js';
    import { Na__LeGrad__SvgPaint, Na__LeGrad__DrawPdf } from './Na__LayoutEditor__GradientTool__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Primitive Kinds and Typography
    // ------------------------------------------------------------
    const Na__LeChrome__KIND_RECT     = 'rect';
    const Na__LeChrome__KIND_LINE     = 'line';
    const Na__LeChrome__KIND_POLYLINE = 'polyline';
    const Na__LeChrome__KIND_TEXT     = 'text';
    const Na__LeChrome__KIND_IMAGE    = 'image';
    const Na__LeChrome__KIND_GROUP    = 'group';
    const Na__LeChrome__MM_PER_POINT  = 25.4 / 72;
    const Na__LeChrome__CAP_HEIGHT    = 0.72;              // <-- Helvetica cap height as a fraction of the font size
    const Na__LeChrome__ASSET_EVENT   = 'na-layouteditor-asset-loaded';
    const Na__LeChrome__TRUNCATION    = '...';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Measuring Document and Asset Cache
    // ------------------------------------------------------------
    let   Na__LeChrome__MeasureDoc = null;    // <-- jsPDF instance, false when unavailable
    const Na__LeChrome__Assets     = new Map(); // <-- path -> data URL (or null while loading)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Text Measurement
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Throwaway jsPDF Document Used for Measuring
    // ------------------------------------------------------------
    function Na__LeChrome__MeasuringDoc() {
        if (Na__LeChrome__MeasureDoc !== null) return Na__LeChrome__MeasureDoc || null;
        const JsPdf = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
        if (!JsPdf) return null;                                                 // <-- Not latched: jsPDF may load later
        try { Na__LeChrome__MeasureDoc = new JsPdf({ unit : 'mm', format : [ 210, 297 ] }); } catch (e) { Na__LeChrome__MeasureDoc = false; }
        return Na__LeChrome__MeasureDoc || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | jsPDF Font Style for a Weight
    // ------------------------------------------------------------
    function Na__LeChrome__PdfWeight(weight) {
        if (weight === 'bold') return 'bold';
        return (typeof weight === 'number' && weight >= 600) ? 'bold' : 'normal';
    }
    // ------------------------------------------------------------


    // FUNCTION | Measure a Text Run in Paper Millimetres
    // ------------------------------------------------------------
    // trackingMm is counted here as well as painted, so a tracked run runs out of
    // its cell at the same character on screen as it does on paper.
    // ------------------------------------------------------------
    function Na__LeChrome__MeasureTextMm(text, fontMm, weight, trackingMm) {
        const value = String(text === undefined || text === null ? '' : text);
        if (value === '') return 0;
        const tracking = (typeof trackingMm === 'number' && trackingMm > 0) ? trackingMm * value.length : 0;
        const doc = Na__LeChrome__MeasuringDoc();
        if (!doc) return (value.length * fontMm * 0.52) + tracking;
        try {
            doc.setFont('helvetica', Na__LeChrome__PdfWeight(weight));
            doc.setFontSize(fontMm / Na__LeChrome__MM_PER_POINT);
            return doc.getTextWidth(value) + tracking;
        } catch (e) {
            return (value.length * fontMm * 0.52) + tracking;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Truncate a Text Run to a Maximum Paper Width
    // ------------------------------------------------------------
    // trackingMm is optional and last, so every untracked caller is unchanged.
    // ------------------------------------------------------------
    function Na__LeChrome__FitText(text, fontMm, weight, maxWidthMm, trackingMm) {
        const value = String(text === undefined || text === null ? '' : text);
        if (value === '' || !(maxWidthMm > 0)) return value;
        if (Na__LeChrome__MeasureTextMm(value, fontMm, weight, trackingMm) <= maxWidthMm) return value;
        let trimmed = value;
        while (trimmed.length > 0) {
            trimmed = trimmed.slice(0, -1);
            if (Na__LeChrome__MeasureTextMm(trimmed + Na__LeChrome__TRUNCATION, fontMm, weight, trackingMm) <= maxWidthMm) {
                return trimmed.replace(/\s+$/, '') + Na__LeChrome__TRUNCATION;
            }
        }
        return '';
    }
    // ------------------------------------------------------------


    // FUNCTION | Baseline for Text Optically Centred in a Box, or Hung From a Top
    // ------------------------------------------------------------
    function Na__LeChrome__BaselineCentred(boxY, boxHeightMm, fontMm) {
        return boxY + ((boxHeightMm + (fontMm * Na__LeChrome__CAP_HEIGHT)) / 2);
    }
    function Na__LeChrome__BaselineFromTop(topY, fontMm) {
        return topY + (fontMm * Na__LeChrome__CAP_HEIGHT);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Primitive Builders
// -----------------------------------------------------------------------------

    // FUNCTION | Push a Stroked and/or Filled Rectangle
    // ------------------------------------------------------------
    function Na__LeChrome__PushRect(list, x, y, widthMm, heightMm, strokeColour, strokeMm, fillColour, dashMm) {
        list.push({ Kind : Na__LeChrome__KIND_RECT, X : x, Y : y, WidthMm : widthMm, HeightMm : heightMm,
                    StrokeColour : strokeColour || null, StrokeMm : (typeof strokeMm === 'number') ? strokeMm : 0,
                    FillColour : fillColour || null, DashMm : dashMm || 0 });
    }
    // ------------------------------------------------------------


    // FUNCTION | Push a Straight Rule
    // ------------------------------------------------------------
    function Na__LeChrome__PushLine(list, x1, y1, x2, y2, strokeColour, strokeMm, dashMm) {
        list.push({ Kind : Na__LeChrome__KIND_LINE, X1 : x1, Y1 : y1, X2 : x2, Y2 : y2,
                    StrokeColour : strokeColour, StrokeMm : strokeMm, DashMm : dashMm || 0 });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Opacity for Painting: 0 Clear to 1 Solid, Anything Missing Is Solid
    // ------------------------------------------------------------
    // A primitive built before opacity existed has no field at all, and reads
    // as solid here, so it paints exactly as it always did.
    // ------------------------------------------------------------
    function Na__LeChrome__Alpha(value) {
        return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Push a Polyline (points as [x, y] pairs), Optionally Closed, Filled, Graded and Dashed
    // ------------------------------------------------------------
    // gradient is optional, so every earlier caller is unchanged. It is a
    // Shape__Gradient record, and both painters hand it to the gradient tool.
    // extra is optional and last: { dashMm, dashArray, fillOpacity, strokeOpacity }.
    // dashMm of 0 is a solid line (an equal dash and gap when it is above 0);
    // dashArray is paper millimetres, a centre line's long-short-long, and
    // wins over dashMm when it has anything in it. An opacity runs 0 (clear)
    // to 1 (solid).
    // ------------------------------------------------------------
    function Na__LeChrome__PushPolyline(list, points, strokeColour, strokeMm, fillColour, closed, gradient, extra) {
        if (!points || points.length < 2) return;
        const more = (extra && typeof extra === 'object') ? extra : {};
        const dashArray = Array.isArray(more.dashArray)
            ? more.dashArray.filter((n) => Number.isFinite(n) && n > 0)
            : [];
        list.push({ Kind : Na__LeChrome__KIND_POLYLINE, Points : points, StrokeColour : strokeColour || null,
                    StrokeMm : strokeMm || 0, FillColour : fillColour || null, Closed : closed === true,
                    Gradient : (gradient && typeof gradient === 'object') ? gradient : null,
                    DashMm : dashArray.length > 0 ? 0 : ((Number.isFinite(more.dashMm) && more.dashMm > 0) ? more.dashMm : 0),
                    DashArray : dashArray.length > 0 ? dashArray : null,
                    FillOpacity : Na__LeChrome__Alpha(more.fillOpacity), StrokeOpacity : Na__LeChrome__Alpha(more.strokeOpacity) });
    }
    // ------------------------------------------------------------


    // FUNCTION | Push a Text Run at an Absolute Baseline
    // ------------------------------------------------------------
    // spec: { X, BaselineY, Text, FontMm, Weight, Colour, Align, RotateDeg, FontFamily, TrackingMm }
    // ------------------------------------------------------------
    function Na__LeChrome__PushText(list, spec) {
        const value = String(spec.Text === undefined || spec.Text === null ? '' : spec.Text);
        if (value === '') return;
        list.push({ Kind : Na__LeChrome__KIND_TEXT, X : spec.X, BaselineY : spec.BaselineY, Text : value,
                    FontMm : spec.FontMm, Weight : spec.Weight || 'normal', Colour : spec.Colour,
                    Align : spec.Align || 'left', RotateDeg : spec.RotateDeg || 0, FontFamily : spec.FontFamily || null,
                    TrackingMm : (typeof spec.TrackingMm === 'number' && spec.TrackingMm > 0) ? spec.TrackingMm : 0 });
    }
    // ------------------------------------------------------------


    // FUNCTION | Push a Placed Raster Image
    // ------------------------------------------------------------
    function Na__LeChrome__PushImage(list, x, y, widthMm, heightMm, dataUrl, format) {
        if (!dataUrl) return;
        list.push({ Kind : Na__LeChrome__KIND_IMAGE, X : x, Y : y, WidthMm : widthMm, HeightMm : heightMm,
                    DataUrl : dataUrl, Format : format || Na__LeChrome__FormatOf(dataUrl) });
    }
    // ------------------------------------------------------------


    // FUNCTION | Push a Group of Children Clipped to a Rectangle
    // ------------------------------------------------------------
    function Na__LeChrome__PushGroup(list, clipRect, children) {
        list.push({ Kind : Na__LeChrome__KIND_GROUP, ClipRect : clipRect || null, Children : children || [] });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Image Format From a Data URL
    // ------------------------------------------------------------
    function Na__LeChrome__FormatOf(dataUrl) {
        if (/^data:image\/jpeg/i.test(dataUrl)) return 'JPEG';
        if (/^data:image\/webp/i.test(dataUrl)) return 'WEBP';
        return 'PNG';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sheet Chrome Assembly
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Border and Caption of One Viewport Frame
    // ------------------------------------------------------------
    function Na__LeChrome__BuildFrame(list, sheet, viewport, style) {
        // A HIDDEN FRAME TAKES ITS CAPTION WITH IT. The caption box hangs off the
        // frame's corner and is drawn in its lines, so with the border gone it has
        // nothing to hang on; the view is titled by hand instead. Leaving both out
        // of this list leaves them off the screen and off the PDF alike.
        if (viewport.Viewport__ShowFrame === false) return;
        const frame  = viewport.Viewport__FrameMm;
        const source = Na__LeModel__ResolveViewportSource(viewport);
        Na__LeChrome__PushRect(list, frame.X, frame.Y, frame.WidthMm, frame.HeightMm, style.frameLineColour, style.frameStrokeMm, null);

        if (viewport.Viewport__ShowScaleLabel === false) return;
        let   caption = source.label + (viewport.Viewport__Kind === Na__LeModel__KIND_2D
            ? '   ' + Na__LeScale__FormatLabel(viewport.Viewport__ScaleDenominator)
            : '');
        if (style.frameLabelUppercase) caption = caption.toUpperCase();

        const fontMm  = style.frameLabelFontMm;
        const weight  = style.frameLabelWeight;
        const track   = style.frameLabelTrackingMm;
        const pad     = style.cellPaddingMm;
        const textMm  = Na__LeChrome__MeasureTextMm(caption, fontMm, weight, track);
        const boxW    = Math.min(frame.WidthMm, textMm + (pad * 2));
        const boxH    = style.frameLabelHeightMm;
        const boxY    = frame.Y + frame.HeightMm - boxH;

        Na__LeChrome__PushRect(list, frame.X, boxY, boxW, boxH, style.frameLineColour, style.frameStrokeMm, style.paperColour);
        Na__LeChrome__PushText(list, {
            X : frame.X + pad, BaselineY : Na__LeChrome__BaselineCentred(boxY, boxH, fontMm),
            Text : Na__LeChrome__FitText(caption, fontMm, weight, boxW - (pad * 2), track),
            FontMm : fontMm, Weight : weight, Colour : style.inkColour, Align : 'left', TrackingMm : track
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Build Every Chrome Primitive for a Sheet
    // ------------------------------------------------------------
    // context: { fields, includeFrames, includeTitleBlock }
    // The classic title block is a scan of the whole sheet, so the modern
    // border is only drawn for the modern style.
    // ------------------------------------------------------------
    function Na__LeChrome__Build(layout, sheet, context) {
        const list     = [];
        const settings = context || {};
        const style    = Na__LeCfg__GetStyleSetup();
        const border   = Na__LeCfg__GetSheetSetup().borderStrokeMm;

        if (layout.TitleBlockStyle === 'classic') {
            if (settings.includeTitleBlock !== false) Na__LeTitleClassic__Build(list, layout, settings.fields || {}, style, Na__LeChrome__CachedAsset);
        } else {
            const content = layout.Content;
            Na__LeChrome__PushRect(list, content.X, content.Y, content.WidthMm, content.HeightMm, style.inkColour, border, null);
            if (settings.includeTitleBlock !== false) Na__LeTitleModern__Build(list, layout, settings.fields || {}, style, Na__LeChrome__CachedAsset);
        }

        if (settings.includeFrames !== false && sheet) {
            sheet.Sheet__Viewports.forEach((viewport) => {
                if (!Na__LeModel__IsLayerVisible(sheet, viewport.Viewport__LayerId)) return;
                Na__LeChrome__BuildFrame(list, sheet, viewport, style);
            });
        }
        return list;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | SVG Renderer
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Escape Text for Markup
    // ------------------------------------------------------------
    function Na__LeChrome__Escape(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Round for Markup
    // ------------------------------------------------------------
    function Na__LeChrome__R(value) { return Math.round(value * 1000) / 1000; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Dash Pattern a Primitive Paints, Paper Millimetres
    // ------------------------------------------------------------
    // DashArray wins when it has anything in it (a centre line, a dotted
    // edge). Otherwise an equal DashMm dash and gap, which is what leaders
    // and the older polyline extra still send. An empty list is solid.
    // ------------------------------------------------------------
    function Na__LeChrome__DashList(primitive) {
        if (Array.isArray(primitive.DashArray) && primitive.DashArray.length > 0) {
            return primitive.DashArray.filter((n) => Number.isFinite(n) && n > 0);
        }
        if (primitive.DashMm > 0) return [ primitive.DashMm, primitive.DashMm ];
        return [];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Serialise One Primitive to SVG
    // ------------------------------------------------------------
    function Na__LeChrome__ToSvg(primitive, style, clipCounter) {
        const R = Na__LeChrome__R;
        const dash = (p) => {
            const list = Na__LeChrome__DashList(p);
            return list.length > 0 ? ' stroke-dasharray="' + list.map(R).join(' ') + '"' : '';
        };

        if (primitive.Kind === Na__LeChrome__KIND_RECT) {
            return '<rect x="' + R(primitive.X) + '" y="' + R(primitive.Y) + '" width="' + R(primitive.WidthMm) + '" height="' + R(primitive.HeightMm) +
                   '" fill="' + (primitive.FillColour || 'none') + '" stroke="' + (primitive.StrokeColour || 'none') +
                   '" stroke-width="' + R(primitive.StrokeMm) + '"' + dash(primitive) + '/>';
        }
        if (primitive.Kind === Na__LeChrome__KIND_LINE) {
            return '<line x1="' + R(primitive.X1) + '" y1="' + R(primitive.Y1) + '" x2="' + R(primitive.X2) + '" y2="' + R(primitive.Y2) +
                   '" stroke="' + primitive.StrokeColour + '" stroke-width="' + R(primitive.StrokeMm) + '" stroke-linecap="round"' + dash(primitive) + '/>';
        }
        if (primitive.Kind === Na__LeChrome__KIND_POLYLINE) {
            const d      = primitive.Points.map((p, i) => (i === 0 ? 'M' : 'L') + R(p[0]) + ' ' + R(p[1])).join('') + (primitive.Closed ? 'Z' : '');
            // A DASHED RUN takes butt caps, the PDF's own, so its dashes break in
            // the same places on the screen as on paper; a solid run keeps the
            // round cap and join that tidy a polyline's corners.
            const dashList = Na__LeChrome__DashList(primitive);
            const dashed   = dashList.length > 0;
            const fillA  = Na__LeChrome__Alpha(primitive.FillOpacity);
            const edgeA  = Na__LeChrome__Alpha(primitive.StrokeOpacity);
            const fillOp = fillA < 1 ? ' fill-opacity="' + R(fillA) + '"' : '';
            const edges  = ' stroke="' + (primitive.StrokeColour || 'none') + '" stroke-width="' + R(primitive.StrokeMm) + '" stroke-linejoin="round" stroke-linecap="' + (dashed ? 'butt' : 'round') + '"' +
                           (dashed ? ' stroke-dasharray="' + dashList.map(R).join(' ') + '"' : '') +
                           (edgeA < 1 ? ' stroke-opacity="' + R(edgeA) + '"' : '') + '/>';
            // A GRADIENT PAINTS OVER ANY SOLID FILL AND UNDER THE EDGES. The solid
            // fill gets a path of its own so the gradient's alpha end shows it
            // through; the edges ride on the gradient's path, on top of both.
            const paint = primitive.Gradient ? Na__LeGrad__SvgPaint(primitive.Points, primitive.Gradient) : null;
            if (paint) {
                const solid = primitive.FillColour ? '<path d="' + d + '" fill="' + primitive.FillColour + '"' + fillOp + ' stroke="none"/>' : '';
                return paint.defs + solid + '<path d="' + d + '" fill="' + paint.fill + '"' + edges;
            }
            return '<path d="' + d + '" fill="' + (primitive.FillColour || 'none') + '"' + (primitive.FillColour ? fillOp : '') + edges;
        }
        if (primitive.Kind === Na__LeChrome__KIND_TEXT) {
            const anchor = primitive.Align === 'right' ? 'end' : (primitive.Align === 'center' ? 'middle' : 'start');
            const weight = (primitive.Weight === 'bold') ? 700 : (typeof primitive.Weight === 'number' ? primitive.Weight : 400);
            const rotate = primitive.RotateDeg ? ' transform="rotate(' + R(primitive.RotateDeg) + ' ' + R(primitive.X) + ' ' + R(primitive.BaselineY) + ')"' : '';
            const track  = primitive.TrackingMm ? ' letter-spacing="' + R(primitive.TrackingMm) + '"' : '';
            return '<text x="' + R(primitive.X) + '" y="' + R(primitive.BaselineY) + '" font-family="' + Na__LeChrome__Escape(primitive.FontFamily || style.fontFamily) +
                   '" font-size="' + R(primitive.FontMm) + '" font-weight="' + weight + '" fill="' + primitive.Colour + '" text-anchor="' + anchor + '"' +
                   track + rotate + ' xml:space="preserve">' + Na__LeChrome__Escape(primitive.Text) + '</text>';
        }
        if (primitive.Kind === Na__LeChrome__KIND_IMAGE) {
            return '<image x="' + R(primitive.X) + '" y="' + R(primitive.Y) + '" width="' + R(primitive.WidthMm) + '" height="' + R(primitive.HeightMm) +
                   '" preserveAspectRatio="none" href="' + primitive.DataUrl + '"/>';
        }
        if (primitive.Kind === Na__LeChrome__KIND_GROUP) {
            const inner = primitive.Children.map((child) => Na__LeChrome__ToSvg(child, style, clipCounter)).join('');
            if (!primitive.ClipRect) return '<g>' + inner + '</g>';
            const id = 'naLeClip' + (clipCounter.n++);
            const c  = primitive.ClipRect;
            return '<clipPath id="' + id + '"><rect x="' + R(c.X) + '" y="' + R(c.Y) + '" width="' + R(c.WidthMm) + '" height="' + R(c.HeightMm) + '"/></clipPath>' +
                   '<g clip-path="url(#' + id + ')">' + inner + '</g>';
        }
        return '';
    }
    // ------------------------------------------------------------


    // FUNCTION | Render Primitives to a Standalone SVG Overlay
    // ------------------------------------------------------------
    function Na__LeChrome__ToSvgMarkup(primitives, pageWidthMm, pageHeightMm, cssClassName) {
        const style   = Na__LeCfg__GetStyleSetup();
        const counter = { n : 0 };
        const body    = primitives.map((p) => Na__LeChrome__ToSvg(p, style, counter)).join('');
        return '<svg xmlns="http://www.w3.org/2000/svg" class="' + (cssClassName || '') + '" viewBox="0 0 ' + pageWidthMm + ' ' + pageHeightMm +
               '" preserveAspectRatio="none" focusable="false" aria-hidden="true">' + body + '</svg>';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | PDF Renderer
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Hex Colour to RGB, Sanitised
    // ------------------------------------------------------------
    function Na__LeChrome__Rgb(hexColour) {
        let value = String(hexColour || '').trim();
        if (!/^#?[0-9a-fA-F]{6}$/.test(value)) value = '#172b3a';
        value = value.replace('#', '');
        return { R : parseInt(value.substring(0, 2), 16), G : parseInt(value.substring(2, 4), 16), B : parseInt(value.substring(4, 6), 16) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw With a Fill and an Edge Opacity
    // ------------------------------------------------------------
    // A PDF takes transparency from an ExtGState: jsPDF's opacity is the fill
    // alpha and its stroke-opacity the edges'. The state is set inside a save
    // and restore so the alpha ends with the drawing - otherwise every
    // primitive after it would inherit it - and only when one of the two is
    // below 1, so a solid drawing writes nothing extra. A jsPDF build without
    // GState draws solid rather than not at all.
    // ------------------------------------------------------------
    function Na__LeChrome__WithOpacity(doc, fillAlpha, strokeAlpha, draw) {
        const translucent = fillAlpha < 1 || strokeAlpha < 1;
        const supported   = typeof doc.GState === 'function' && typeof doc.setGState === 'function' &&
                            typeof doc.saveGraphicsState === 'function' && typeof doc.restoreGraphicsState === 'function';
        if (!translucent || !supported) { draw(); return; }
        doc.saveGraphicsState();
        try {
            doc.setGState(new doc.GState({ 'opacity' : fillAlpha, 'stroke-opacity' : strokeAlpha }));
            draw();
        } finally {
            doc.restoreGraphicsState();
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Width jsPDF Aligns a Text Run By, in Page Units
    // ------------------------------------------------------------
    // Its string width at the current font and size, character spacing
    // included and no kerning, exactly as jsPDF measures a line to centre or
    // right-align it.
    // ------------------------------------------------------------
    function Na__LeChrome__PdfRunWidth(doc, text, charSpace) {
        const fontSize = doc.internal.getFontSize();
        const options  = { font : doc.internal.getFont(), fontSize : fontSize, doKerning : false };
        if (charSpace) options.charSpace = charSpace;
        return doc.getStringUnitWidth(String(text), options) * fontSize / doc.internal.scaleFactor;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw One Primitive Into jsPDF
    // ------------------------------------------------------------
    function Na__LeChrome__ToPdf(doc, primitive, style) {
        const setDash = (p) => { try { doc.setLineDashPattern(Na__LeChrome__DashList(p), 0); } catch (e) { /* older jsPDF */ } };

        if (primitive.Kind === Na__LeChrome__KIND_RECT) {
            const fill = primitive.FillColour ? Na__LeChrome__Rgb(primitive.FillColour) : null;
            const stroke = primitive.StrokeColour ? Na__LeChrome__Rgb(primitive.StrokeColour) : null;
            if (fill)   doc.setFillColor(fill.R, fill.G, fill.B);
            if (stroke) { doc.setDrawColor(stroke.R, stroke.G, stroke.B); doc.setLineWidth(primitive.StrokeMm); setDash(primitive); }
            if (fill || stroke) doc.rect(primitive.X, primitive.Y, primitive.WidthMm, primitive.HeightMm, fill ? (stroke ? 'FD' : 'F') : 'S');
            return;
        }
        if (primitive.Kind === Na__LeChrome__KIND_LINE) {
            const stroke = Na__LeChrome__Rgb(primitive.StrokeColour);
            doc.setDrawColor(stroke.R, stroke.G, stroke.B); doc.setLineWidth(primitive.StrokeMm); setDash(primitive);
            doc.line(primitive.X1, primitive.Y1, primitive.X2, primitive.Y2);
            return;
        }
        if (primitive.Kind === Na__LeChrome__KIND_POLYLINE) {
            const first = primitive.Points[0];
            const rel   = [];
            for (let i = 1; i < primitive.Points.length; i++) {
                rel.push([ primitive.Points[i][0] - primitive.Points[i - 1][0], primitive.Points[i][1] - primitive.Points[i - 1][1] ]);
            }
            const fill   = primitive.FillColour ? Na__LeChrome__Rgb(primitive.FillColour) : null;
            const stroke = primitive.StrokeColour ? Na__LeChrome__Rgb(primitive.StrokeColour) : null;
            const fillA  = fill ? Na__LeChrome__Alpha(primitive.FillOpacity) : 1;
            const edgeA  = stroke ? Na__LeChrome__Alpha(primitive.StrokeOpacity) : 1;
            const dash   = { DashMm : primitive.DashMm > 0 ? primitive.DashMm : 0, DashArray : primitive.DashArray || null };
            if (primitive.Gradient) {
                // A GRADIENT GOES IN THREE PASSES rather than one fill-and-stroke:
                // any solid fill, then the gradient clipped over it, then the edges
                // on top, so the gradient's solid end can never paint over an edge.
                if (fill)   Na__LeChrome__WithOpacity(doc, fillA, 1, () => { doc.setFillColor(fill.R, fill.G, fill.B); doc.lines(rel, first[0], first[1], [ 1, 1 ], 'F', primitive.Closed === true); });
                Na__LeGrad__DrawPdf(doc, primitive.Points, primitive.Gradient);
                if (stroke) Na__LeChrome__WithOpacity(doc, 1, edgeA, () => { doc.setDrawColor(stroke.R, stroke.G, stroke.B); doc.setLineWidth(primitive.StrokeMm); setDash(dash); doc.lines(rel, first[0], first[1], [ 1, 1 ], 'S', primitive.Closed === true); });
                if (Na__LeChrome__DashList(dash).length > 0) setDash({ DashMm : 0, DashArray : null });
                return;
            }
            Na__LeChrome__WithOpacity(doc, fillA, edgeA, () => {
                if (fill)   doc.setFillColor(fill.R, fill.G, fill.B);
                if (stroke) { doc.setDrawColor(stroke.R, stroke.G, stroke.B); doc.setLineWidth(primitive.StrokeMm); setDash(dash); }
                doc.lines(rel, first[0], first[1], [ 1, 1 ], fill ? (stroke ? 'FD' : 'F') : 'S', primitive.Closed === true);
            });
            if (Na__LeChrome__DashList(dash).length > 0) setDash({ DashMm : 0, DashArray : null });   // <-- A dash never carries into the next primitive
            return;
        }
        if (primitive.Kind === Na__LeChrome__KIND_TEXT) {
            const ink = Na__LeChrome__Rgb(primitive.Colour);
            doc.setFont('helvetica', Na__LeChrome__PdfWeight(primitive.Weight));
            doc.setFontSize(primitive.FontMm / Na__LeChrome__MM_PER_POINT);
            doc.setTextColor(ink.R, ink.G, ink.B);
            const options = { align : primitive.Align === 'center' ? 'center' : (primitive.Align === 'right' ? 'right' : 'left'), baseline : 'alphabetic' };
            if (primitive.TrackingMm) options.charSpace = primitive.TrackingMm;  // <-- jsPDF sets character spacing in the page unit, which is mm here
            let x = primitive.X, y = primitive.BaselineY;
            if (primitive.RotateDeg) {
                options.angle = -primitive.RotateDeg;                              // <-- jsPDF rotates counter-clockwise
                // A TURNED RUN IS PLACED BY ITS LEFT END. jsPDF would shift a
                // centred or right-aligned run along the page's x axis and then
                // turn it about that shifted start; walked back along the turned
                // baseline instead, it lands where the screen draws it.
                if (options.align !== 'left') {
                    const width = Na__LeChrome__PdfRunWidth(doc, primitive.Text, options.charSpace);
                    const back  = options.align === 'center' ? width / 2 : width;
                    const a     = primitive.RotateDeg * (Math.PI / 180);
                    x -= back * Math.cos(a);
                    y -= back * Math.sin(a);
                    options.align = 'left';
                }
            }
            doc.text(primitive.Text, x, y, options);
            return;
        }
        if (primitive.Kind === Na__LeChrome__KIND_IMAGE) {
            doc.addImage(primitive.DataUrl, primitive.Format || 'PNG', primitive.X, primitive.Y, primitive.WidthMm, primitive.HeightMm);
            return;
        }
        if (primitive.Kind === Na__LeChrome__KIND_GROUP) {
            let clipped = false;
            if (primitive.ClipRect && typeof doc.saveGraphicsState === 'function' && typeof doc.clip === 'function') {
                try {
                    doc.saveGraphicsState();
                    const c = primitive.ClipRect;
                    doc.rect(c.X, c.Y, c.WidthMm, c.HeightMm, null);
                    doc.clip();
                    doc.discardPath();
                    clipped = true;
                } catch (clipError) { clipped = false; }
            }
            primitive.Children.forEach((child) => Na__LeChrome__ToPdf(doc, child, style));
            if (clipped) { try { doc.restoreGraphicsState(); } catch (e) { /* nothing to restore */ } }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Render Primitives Into a jsPDF Document
    // ------------------------------------------------------------
    function Na__LeChrome__DrawToPdf(doc, primitives) {
        const style = Na__LeCfg__GetStyleSetup();
        primitives.forEach((primitive) => {
            try { Na__LeChrome__ToPdf(doc, primitive, style); }
            catch (drawError) { console.warn('[TrueVision3D LayoutEditor] Primitive could not be drawn:', primitive.Kind, drawError); }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Image Assets
// -----------------------------------------------------------------------------

    // FUNCTION | Load an Image Asset Once as a Data URL (announces on arrival)
    // ------------------------------------------------------------
    function Na__LeChrome__LoadAsset(path) {
        if (!path) return Promise.resolve(null);
        if (Na__LeChrome__Assets.has(path)) {
            const cached = Na__LeChrome__Assets.get(path);
            return Promise.resolve(cached instanceof Promise ? null : cached);
        }
        const loading = fetch(path).then((response) => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.blob();
        }).then((blob) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('read failed'));
            reader.readAsDataURL(blob);
        })).then((dataUrl) => {
            Na__LeChrome__Assets.set(path, dataUrl);
            window.dispatchEvent(new CustomEvent(Na__LeChrome__ASSET_EVENT, { detail : { path : path } }));
            return dataUrl;
        }).catch((assetError) => {
            console.warn('[TrueVision3D LayoutEditor] Asset unavailable: ' + path, assetError);
            Na__LeChrome__Assets.set(path, null);
            return null;
        });
        Na__LeChrome__Assets.set(path, loading);
        return loading;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Cached Asset Without Waiting (starts the load when unknown)
    // ------------------------------------------------------------
    function Na__LeChrome__CachedAsset(path) {
        if (!path) return null;
        if (!Na__LeChrome__Assets.has(path)) { void Na__LeChrome__LoadAsset(path); return null; }
        const value = Na__LeChrome__Assets.get(path);
        return (typeof value === 'string') ? value : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Chrome API
    // ------------------------------------------------------------
    export {
        Na__LeChrome__ASSET_EVENT,
        Na__LeChrome__MeasureTextMm,
        Na__LeChrome__FitText,
        Na__LeChrome__BaselineCentred,
        Na__LeChrome__BaselineFromTop,
        Na__LeChrome__PushRect,
        Na__LeChrome__PushLine,
        Na__LeChrome__PushPolyline,
        Na__LeChrome__PushText,
        Na__LeChrome__PushImage,
        Na__LeChrome__PushGroup,
        Na__LeChrome__Build,
        Na__LeChrome__ToSvgMarkup,
        Na__LeChrome__DrawToPdf,
        Na__LeChrome__LoadAsset,
        Na__LeChrome__CachedAsset
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
