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


    // FUNCTION | Push a Polyline (points as [x, y] pairs), Optionally Closed and Filled
    // ------------------------------------------------------------
    function Na__LeChrome__PushPolyline(list, points, strokeColour, strokeMm, fillColour, closed) {
        if (!points || points.length < 2) return;
        list.push({ Kind : Na__LeChrome__KIND_POLYLINE, Points : points, StrokeColour : strokeColour || null,
                    StrokeMm : strokeMm || 0, FillColour : fillColour || null, Closed : closed === true });
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


    // HELPER FUNCTION | Serialise One Primitive to SVG
    // ------------------------------------------------------------
    function Na__LeChrome__ToSvg(primitive, style, clipCounter) {
        const R = Na__LeChrome__R;
        const dash = (p) => (p.DashMm > 0 ? ' stroke-dasharray="' + R(p.DashMm) + ' ' + R(p.DashMm) + '"' : '');

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
            const d = primitive.Points.map((p, i) => (i === 0 ? 'M' : 'L') + R(p[0]) + ' ' + R(p[1])).join('') + (primitive.Closed ? 'Z' : '');
            return '<path d="' + d + '" fill="' + (primitive.FillColour || 'none') + '" stroke="' + (primitive.StrokeColour || 'none') +
                   '" stroke-width="' + R(primitive.StrokeMm) + '" stroke-linejoin="round" stroke-linecap="round"/>';
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


    // HELPER FUNCTION | Draw One Primitive Into jsPDF
    // ------------------------------------------------------------
    function Na__LeChrome__ToPdf(doc, primitive, style) {
        const setDash = (p) => { try { doc.setLineDashPattern(p.DashMm > 0 ? [ p.DashMm, p.DashMm ] : [], 0); } catch (e) { /* older jsPDF */ } };

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
            const fill = primitive.FillColour ? Na__LeChrome__Rgb(primitive.FillColour) : null;
            const stroke = primitive.StrokeColour ? Na__LeChrome__Rgb(primitive.StrokeColour) : null;
            if (fill)   doc.setFillColor(fill.R, fill.G, fill.B);
            if (stroke) { doc.setDrawColor(stroke.R, stroke.G, stroke.B); doc.setLineWidth(primitive.StrokeMm); setDash({ DashMm : 0 }); }
            doc.lines(rel, first[0], first[1], [ 1, 1 ], fill ? (stroke ? 'FD' : 'F') : 'S', primitive.Closed === true);
            return;
        }
        if (primitive.Kind === Na__LeChrome__KIND_TEXT) {
            const ink = Na__LeChrome__Rgb(primitive.Colour);
            doc.setFont('helvetica', Na__LeChrome__PdfWeight(primitive.Weight));
            doc.setFontSize(primitive.FontMm / Na__LeChrome__MM_PER_POINT);
            doc.setTextColor(ink.R, ink.G, ink.B);
            const options = { align : primitive.Align === 'center' ? 'center' : (primitive.Align === 'right' ? 'right' : 'left'), baseline : 'alphabetic' };
            if (primitive.TrackingMm) options.charSpace = primitive.TrackingMm;  // <-- jsPDF sets character spacing in the page unit, which is mm here
            if (primitive.RotateDeg) options.angle = -primitive.RotateDeg;     // <-- jsPDF rotates counter-clockwise
            doc.text(primitive.Text, primitive.X, primitive.BaselineY, options);
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
