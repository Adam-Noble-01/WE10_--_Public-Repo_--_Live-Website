// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PDF EXPORTER
// =============================================================================
//
// FILE       : Na__LayoutEditor__PdfExporter__.js
// NAMESPACE  : Na__LePdf
// MODULE     : Layout Editor - PDF Exporter
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : One sheet to a PDF at true paper size: vector linework, dimensions, text and chrome; raster underlays and 3D views
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - jsPDF (the vendored UMD build, injected as a classic script on first
//   use) opens a page of the sheet's paper size. Bottom to top: the classic
//   title block scan when that style is on, each viewport clipped to its
//   frame (the composer underlay at RasterPixelsPerMm, the projected
//   linework as true vector lines at the paper widths with a dash for the
//   hidden class, the scene markup at scale), the sheet's own markup, and
//   the chrome (border, frames, captions, modern title block or the
//   classic field texts) drawn last so captions sit above content (D35).
// - Printed at 100 percent a 1:50 viewport measures true because every
//   coordinate is a paper millimetre.
// - Open Sans is embedded before anything is drawn. jsPDF's built-in
//   Helvetica is only the fallback when the TTF files cannot be fetched.
//   // @delegate: ./Na__LayoutEditor__PdfFonts__.js
//
// INTEGRATION:
// - Toolbar Download PDF and the Dev menu Export PDF call ExportSheet.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__PdfExporter__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.6.0 (TrueVision)
// - Depth fog. A 2D viewport whose drawing has its fog switched on gets a
//   third layer in its clip: the fog image, after the vector linework and
//   before the scene markup, as the frame stacks it on screen. It is the first
//   raster to go OVER the vectors. Added as 'PNG' from a PNG data URL, which is
//   what keeps its alpha; a viewport with no fog adds nothing.
//
// 17-Sep-2026 - Version 1.5.0 (TrueVision)
// - A downloaded sheet is named after the drawing rather than after the app:
//   PS01_T02_D01__FloorPlans__A2__RevB__17-Sep-2026__.pdf. The tokens are
//   {drawingCode} {drawingName} {paperSize} {revision} {date}, and every one but
//   the date is read through Na__LeModel__GetFields, so the name carries the same
//   drawing number, revision and paper the title block prints.
// - Na__LePdf__DrawingName turns a sheet's tab name into the middle segment:
//   a leading sheet number comes off (it is already in the code) and the words run
//   together in PascalCase - "D01 - Floor Plans" gives FloorPlans.
//
// 14-Sep-2026 - Version 1.4.0 (TrueVision)
// - Download PDF embeds Open Sans (Light, Regular, SemiBold) so sheet text,
//   title block, captions, dimensions and notes print in the app face
//   rather than Helvetica (Na__LayoutEditor__PdfFonts__).
//
// 14-Sep-2026 - Version 1.3.0 (TrueVision)
// - A 3D viewport's picture goes at Na__LeVp3d__ExportRectMm: the whole
//   picture's rectangle as before, or the frame itself once the frame shows a
//   window of a zoomed or slid picture - which is what the export rendered.
//
// 14-Sep-2026 - Version 1.2.0 (TrueVision)
// - Site plan viewports print their fills (each face's outer ring at the layer's
//   fill colour and opacity) and then their lines, styled exactly as the sheet
//   paints them, with no raster underlay.
//
// 14-Sep-2026 - Version 1.1.0 (TrueVision)
// - Project Specification: an export waits for the specification to load
//   (capped at its load timeout), so a sheet's notes margin prints its notes and
//   not an empty column. The margin itself arrives with the sheet's markup.
// - A notes margin with notes that did not fit still exports, and the toast
//   says how many were left out rather than reporting a clean PDF.
//
// 13-Sep-2026 - Version 1.0.3 (TrueVision)
// - A viewport's linework is projected from its own design phase (Model Source),
//   waiting for that phase to load when it has not.
//
// 10-Sep-2026 - Version 1.0.2
// - Viewport pictures at the raster export level (High), whatever the working level on screen.
//
// 10-Sep-2026 - Version 1.0.1
// - Linework widths from the sheet's viewport lineweight; shapes arrive through the markup primitives.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Layout, Model, Chrome, Markup, Viewports, Assets
    // ------------------------------------------------------------
    import { Na__LeCfg__GetPdfSetup, Na__LeCfg__GetLineworkSetup, Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LePdfFonts__EnsureLoaded, Na__LePdfFonts__Install } from './Na__LayoutEditor__PdfFonts__.js';
    import { Na__LeFileName__Build } from './Na__LayoutEditor__PdfFilename__.js';   // <-- Shared with the specification download, so both name their files alike
    import { Na__LeScale__SheetLabel } from '../07__Core__SheetData/Na__LayoutEditor__ScaleManager__.js';
    import { Na__LeLayout__Solve } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeModel__KIND_2D, Na__LeModel__GetLayers, Na__LeModel__GetFields, Na__LeModel__IsLayerVisible, Na__LeModel__IsSitePlanViewport } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeChrome__Build, Na__LeChrome__DrawToPdf, Na__LeChrome__PushPolyline } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeMarkup__BuildScenePrimitives, Na__LeMarkup__BuildSheetPrimitives } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeVp2d__Describe, Na__LeVp2d__EnsureLinework, Na__LeVp2d__RenderForExport, Na__LeVp2d__RenderFogForExport, Na__LeVp2d__StyleBands, Na__LeVp2d__SitePlanDrawing } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeHatch__DrawPdf } from '../36__System__HatchPatternTools/Na__LayoutEditor__HatchPatterns__.js';
    import { Na__LeVp3d__RenderForExport, Na__LeVp3d__ExportRectMm } from '../20__System__Viewports/Na__LayoutEditor__Viewport3d__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__LeCfg__GetSpecificationSetup, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeSpec__EnsureLoaded } from '../50__Feature__Specification/Na__LayoutEditor__SpecData__.js';
    import { Na__LeMargin__Report } from '../50__Feature__Specification/Na__LayoutEditor__SpecMargin__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | jsPDF Loading
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Script Injection Promise
    // ------------------------------------------------------------
    let Na__LePdf__LoadPromise = null;
    // ------------------------------------------------------------


    // FUNCTION | Load the Vendored jsPDF UMD Once
    // ------------------------------------------------------------
    function Na__LePdf__LoadLibrary() {
        if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
        if (Na__LePdf__LoadPromise) return Na__LePdf__LoadPromise;
        Na__LePdf__LoadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src   = Na__LeCfg__GetPdfSetup().jsPdfScriptPath;
            script.async = true;
            script.onload  = () => (window.jspdf && window.jspdf.jsPDF) ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF did not register'));
            script.onerror = () => reject(new Error('jsPDF failed to load from ' + script.src));
            document.head.appendChild(script);
        }).catch((error) => { Na__LePdf__LoadPromise = null; throw error; });
        return Na__LePdf__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Make Sure jsPDF Exists and Open Sans Is Ready to Embed
    // ------------------------------------------------------------
    async function Na__LePdf__EnsureJsPdf() {
        const JsPdf = await Na__LePdf__LoadLibrary();
        await Na__LePdfFonts__EnsureLoaded();                                     // <-- TTF in memory before any document is measured or drawn
        return JsPdf;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Shift Frame-Local Primitives Onto the Paper
    // ------------------------------------------------------------
    function Na__LePdf__Offset(primitives, dx, dy) {
        return primitives.map((p) => {
            const c = Object.assign({}, p);
            if (p.Kind === 'rect' || p.Kind === 'image') { c.X = p.X + dx; c.Y = p.Y + dy; }
            else if (p.Kind === 'line') { c.X1 = p.X1 + dx; c.Y1 = p.Y1 + dy; c.X2 = p.X2 + dx; c.Y2 = p.Y2 + dy; }
            else if (p.Kind === 'polyline') { c.Points = p.Points.map((pt) => [ pt[0] + dx, pt[1] + dy ]); }
            else if (p.Kind === 'text') { c.X = p.X + dx; c.BaselineY = p.BaselineY + dy; }
            else if (p.Kind === 'group') { c.Children = Na__LePdf__Offset(p.Children, dx, dy); if (p.ClipRect) c.ClipRect = Object.assign({}, p.ClipRect, { X : p.ClipRect.X + dx, Y : p.ClipRect.Y + dy }); }
            return c;
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Begin and End a Rectangular Clip
    // ------------------------------------------------------------
    function Na__LePdf__BeginClip(doc, rect) {
        try {
            doc.saveGraphicsState();
            doc.rect(rect.X, rect.Y, rect.WidthMm, rect.HeightMm, null);
            doc.clip();
            doc.discardPath();
            return true;
        } catch (e) { return false; }
    }
    function Na__LePdf__EndClip(doc, clipped) {
        if (clipped) { try { doc.restoreGraphicsState(); } catch (e) { /* nothing */ } }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hex to RGB
    // ------------------------------------------------------------
    function Na__LePdf__Rgb(hex) {
        const v = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || '')) ? String(hex).replace('#', '') : '323232';
        return [ parseInt(v.substring(0, 2), 16), parseInt(v.substring(2, 4), 16), parseInt(v.substring(4, 6), 16) ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw the Projected Linework of a 2D Viewport as Vector Lines
    // ------------------------------------------------------------
    function Na__LePdf__DrawLinework(doc, sheet, viewport, described, classes, siteRules) {
        const win   = described.window;
        const setup = Na__LeCfg__GetLineworkSetup();
        const D     = win.Denominator;
        const minLen = setup.minSegmentPaperMm;
        const frame  = viewport.Viewport__FrameMm;
        const showHidden = viewport.Viewport__Styles.hiddenLines === true;
        // THE SAME BANDS THE SCREEN PAINTS. The PDF is paper millimetres already,
        // so widths and dash patterns go in unscaled; the screen multiplies both
        // by the denominator because its SVG is drawn in model millimetres.
        const bands = Na__LeVp2d__StyleBands(viewport, sheet && sheet.Sheet__Lineweights ? sheet.Sheet__Lineweights.ViewportPt : null, classes, showHidden, siteRules);
        bands.forEach((band) => {
            const segments = classes[band.className];
            if (!segments || segments.length < 4) return;
            const rgb  = Na__LePdf__Rgb(band.colour);
            doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
            doc.setLineWidth(band.widthMm);
            doc.setLineCap('round');
            try { doc.setLineDashPattern(band.dashMm && band.dashMm.length ? band.dashMm : [], 0); } catch (e) { /* older build */ }
            const count = band.indices ? band.indices.length : Math.floor(segments.length / 4);
            for (let k = 0; k < count; k++) {
                const i  = (band.indices ? band.indices[k] : k) * 4;
                const x1 = frame.X + ((segments[i]     - win.OriginX) / D), y1 = frame.Y + ((segments[i + 1] - win.OriginY) / D);
                const x2 = frame.X + ((segments[i + 2] - win.OriginX) / D), y2 = frame.Y + ((segments[i + 3] - win.OriginY) / D);
                if (Math.abs(x2 - x1) < minLen && Math.abs(y2 - y1) < minLen) continue;
                // Skip segments wholly outside the frame; the clip handles the rest
                if ((x1 < frame.X && x2 < frame.X) || (x1 > frame.X + frame.WidthMm && x2 > frame.X + frame.WidthMm) ||
                    (y1 < frame.Y && y2 < frame.Y) || (y1 > frame.Y + frame.HeightMm && y2 > frame.Y + frame.HeightMm)) continue;
                doc.line(x1, y1, x2, y2);
            }
        });
        try { doc.setLineDashPattern([], 0); } catch (e) { /* nothing */ }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw a Site Plan Viewport's Fills Under Its Lines
    // ------------------------------------------------------------
    // Each face's outer ring as a filled polygon at the layer's fill colour and
    // opacity, through the sheet polygon primitive (GState opacity). The PDF
    // primitive draws one ring at a time, so a hole in a face is not cut out on
    // paper yet; on screen it is.
    // ------------------------------------------------------------
    function Na__LePdf__DrawSitePlanFills(doc, viewport, described, fills) {
        const win   = described.window;
        const D     = win.Denominator;
        const frame = viewport.Viewport__FrameMm;
        const primitives = [];
        fills.forEach((fill) => {
            fill.rings.forEach((ring) => {
                if (!ring.outer || !ring.points || ring.points.length < 6) return;
                const points = [];
                for (let i = 0; i + 1 < ring.points.length; i += 2) {
                    points.push([ frame.X + ((ring.points[i] - win.OriginX) / D), frame.Y + ((ring.points[i + 1] - win.OriginY) / D) ]);
                }
                Na__LeChrome__PushPolyline(primitives, points, null, 0, fill.hex, true, null, { fillOpacity : fill.opacity });
            });
        });
        if (primitives.length > 0) Na__LeChrome__DrawToPdf(doc, primitives);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw a Site Plan Viewport's Hatch Patterns Over Its Fills
    // ------------------------------------------------------------
    // The ring is converted to paper millimetres once and handed to the hatch
    // module's stamper, which is the same code the sheet's own vector shapes
    // use - so a hatch prints identically whether it came from a site plan
    // layer or from a rectangle somebody drew over it.
    // ------------------------------------------------------------
    function Na__LePdf__DrawSitePlanPatterns(doc, viewport, described, patterns) {
        if (!patterns || patterns.length === 0) return;
        const win   = described.window;
        const D     = win.Denominator;
        const frame = viewport.Viewport__FrameMm;
        patterns.forEach((entry) => {
            entry.rings.forEach((ring) => {
                if (!ring.outer || !ring.points || ring.points.length < 6) return;
                const points = [];
                for (let i = 0; i + 1 < ring.points.length; i += 2) {
                    points.push([ frame.X + ((ring.points[i] - win.OriginX) / D),
                                  frame.Y + ((ring.points[i + 1] - win.OriginY) / D) ]);
                }
                // Clip to the frame as well: a ring can run outside it.
                const framed = Na__LePdf__BeginClip(doc, frame);
                try {
                    Na__LeHatch__DrawPdf(doc, points, {
                        pattern     : entry.pattern,
                        scale       : entry.scale,
                        rotationDeg : entry.rotationDeg,
                        colour      : entry.colour
                    });
                } finally { Na__LePdf__EndClip(doc, framed); }
            });
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw One Viewport
    // ------------------------------------------------------------
    async function Na__LePdf__DrawViewport(doc, sheet, viewport, options) {
        const frame   = viewport.Viewport__FrameMm;
        const clipped = Na__LePdf__BeginClip(doc, frame);
        try {
            if (viewport.Viewport__Kind === Na__LeModel__KIND_2D) {
                const described = Na__LeVp2d__Describe(viewport);
                if (Na__LeModel__IsSitePlanViewport(viewport)) {                 // <-- Site plan data: its fills, then the same bands the sheet paints
                    const drawing = await Na__LeVp2d__SitePlanDrawing(viewport);
                    if (!drawing && options && options.strict) throw new Error('Site plan drawing could not be rendered.');
                    if (drawing) {
                        // THE SAME THREE DECKS THE SCREEN PAINTS, in the same
                        // order: wash, pattern, linework. The build has already
                        // applied the subtype and the deck switches, so an empty
                        // list here means that deck was switched off, not that
                        // the PDF forgot it.
                        Na__LePdf__DrawSitePlanFills(doc, viewport, described, drawing.fills);
                        Na__LePdf__DrawSitePlanPatterns(doc, viewport, described, drawing.patterns);
                        if (drawing.paintLines !== false) Na__LePdf__DrawLinework(doc, sheet, viewport, described, drawing.classes, drawing.siteRules);
                    }
                    return;
                }
                if (!described.definition) { if (options && options.strict) throw new Error('A viewport drawing source is missing.'); return; }
                const underlay = await Na__LeVp2d__RenderForExport(viewport);
                if (underlay && underlay.dataUrl) doc.addImage(underlay.dataUrl, 'PNG', frame.X, frame.Y, frame.WidthMm, frame.HeightMm);
                if (viewport.Viewport__Styles.projectedLinework !== false) {
                    const classes = await Na__LeVp2d__EnsureLinework(described.definition, null, false, described.modelSource);   // <-- The viewport's own design phase
                    if (classes) Na__LePdf__DrawLinework(doc, sheet, viewport, described, classes);
                }
                // DEPTH FOG | The drawing's own fog, where it has one, AFTER the
                // vectors and BEFORE the markup - the frame's own order on screen.
                // It is the one raster that goes over the linework, because fading
                // far LINES is the whole of what it is for; the labels and
                // dimensions then land on top of it untouched. Null for most
                // viewports and costs them nothing.
                // 'PNG' AND A PNG DATA URL, NEVER 'RGBA': the fog is in the image's
                // alpha, and jsPDF 4.1.0 drops the alpha of anything handed over
                // as 'RGBA' - the layer would print as a solid white rectangle
                // over the whole drawing.
                const fog = await Na__LeVp2d__RenderFogForExport(viewport);
                if (fog && fog.dataUrl) doc.addImage(fog.dataUrl, 'PNG', frame.X, frame.Y, frame.WidthMm, frame.HeightMm);
                if (viewport.Viewport__MarkupMode === 'scene') {
                    Na__LeChrome__DrawToPdf(doc, Na__LePdf__Offset(Na__LeMarkup__BuildScenePrimitives(described), frame.X, frame.Y));
                }
                return;
            }
            const dataUrl = await Na__LeVp3d__RenderForExport(sheet, viewport);
            if (!dataUrl && options && options.strict) throw new Error('A 3D viewport could not be rendered.');
            if (dataUrl) {
                const rect = Na__LeVp3d__ExportRectMm(viewport);                   // <-- The picture's own rectangle, or the frame when it shows a window of a zoomed picture
                doc.addImage(dataUrl, 'PNG', frame.X + rect.X, frame.Y + rect.Y, rect.WidthMm, rect.HeightMm);
            }
        } finally {
            Na__LePdf__EndClip(doc, clipped);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Output File Name From the Pattern
    // ------------------------------------------------------------
    // Every token comes from the sheet as the title block reads it, so the file name
    // and the drawing it holds cannot disagree: the drawing code, revision and paper
    // are the ones printed on the sheet, not a second set assembled here. The naming
    // itself lives in Na__LayoutEditor__PdfFilename__, which the specification
    // download shares, so the two come out of the app named the same way.
    //
    // The date is TODAY, the day the file was issued, which is also what the title
    // block prints unless that field has been typed over. To make the file follow an
    // overridden title block date instead, pass fields.Date as parts.date.
    // ------------------------------------------------------------
    function Na__LePdf__Filename(sheet, layout) {
        const fields = Na__LeModel__GetFields(sheet);                              // <-- Defaults filled in, so a blank Drawing No. still names the file
        return Na__LeFileName__Build({
            code        : fields.DocumentId,                                       // <-- The whole identifier, PS01_T02_D01, not the D01 the register writes
            name        : sheet.Sheet__Name,
            paper       : layout.Page.SizeKey,
            revision    : fields.Revision,
            projectCode : Na__DrawData__GetProjectCode()
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Document for a Sheet (returns the jsPDF instance)
    // ------------------------------------------------------------
    async function Na__LePdf__BuildDocument(sheet, options) {
        const JsPdf  = await Na__LePdf__EnsureJsPdf();
        const setup  = Na__LeCfg__GetPdfSetup();
        const layout = Na__LeLayout__Solve(sheet);
        const doc    = new JsPdf({ orientation : layout.Page.Orientation, unit : 'mm', format : [ layout.Page.WidthMm, layout.Page.HeightMm ], compress : true, putOnlyUsedFonts : true });
        Na__LePdfFonts__Install(doc);                                             // <-- Open Sans into this document; Helvetica remains if the TTF never arrived
        const scales = sheet.Sheet__Viewports.filter((v) => v.Viewport__Kind === Na__LeModel__KIND_2D).map((v) => v.Viewport__ScaleDenominator);
        doc.setProperties({
            title   : sheet.Sheet__Name,
            subject : 'TrueVision3D sheet ' + layout.Page.Label + ' ' + layout.Page.Orientation + ', scale ' + Na__LeScale__SheetLabel(scales),
            author  : setup.author,
            creator : setup.creator
        });

        // CHROME | Built once; the classic scan goes under everything, the rest on top
        const chrome = Na__LeChrome__Build(layout, sheet, { fields : Na__LeModel__GetFields(sheet) });
        const scans  = (layout.TitleBlockStyle === 'classic') ? chrome.filter((p) => p.Kind === 'image') : [];
        const rest   = (layout.TitleBlockStyle === 'classic') ? chrome.filter((p) => p.Kind !== 'image') : chrome;
        Na__LeChrome__DrawToPdf(doc, scans);

        // VIEWPORTS | Back to front (the top of the layer list draws last)
        const layers  = Na__LeModel__GetLayers(sheet).map((l) => l.Layer__Id);
        const ordered = sheet.Sheet__Viewports.map((v, i) => ({ v : v, rank : layers.indexOf(v.Viewport__LayerId), i : i }))
            .filter((e) => Na__LeModel__IsLayerVisible(sheet, e.v.Viewport__LayerId))
            .sort((a, b) => (b.rank - a.rank) || (a.i - b.i))
            .map((e) => e.v);
        for (let i = 0; i < ordered.length; i++) await Na__LePdf__DrawViewport(doc, sheet, ordered[i], options);   // <-- Pictures at the raster export level

        // SHEET MARKUP AND CHROME
        Na__LeChrome__DrawToPdf(doc, Na__LeMarkup__BuildSheetPrimitives(sheet, layout, null));
        Na__LeChrome__DrawToPdf(doc, rest);
        return { doc : doc, filename : Na__LePdf__Filename(sheet, layout) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Export a Sheet and Hand the File to the Browser
    // ------------------------------------------------------------
    async function Na__LePdf__ExportSheet(sheet, showToast, options) {
        const toast = (typeof showToast === 'function') ? showToast : () => {};
        if (!sheet) return false;
        try {
            const cap = Na__LeCfg__GetSpecificationSetup().loadTimeoutMs;
            await Promise.race([ Na__LeSpec__EnsureLoaded(), new Promise((resolve) => { window.setTimeout(resolve, cap); }) ]);   // <-- The notes margin prints its notes, not an empty column
            const built = await Na__LePdf__BuildDocument(sheet, options);
            await built.doc.save(built.filename, { returnPromise : true });
            const margin = Na__LeMargin__Report(sheet, null);
            if (margin.on && margin.overflow > 0) toast(Na__LeCfg__FormatLabel('PdfMarginOverflow', 'PDF downloaded, but {count} margin note(s) did not fit and were left out. Widen the notes margin or make its text smaller.', { count : margin.overflow }), true);
            else toast(Na__LeCfg__GetLabel('PdfReadyMessage', 'PDF downloaded.'), false);
            return true;
        } catch (exportError) {
            console.error('[TrueVision3D LayoutEditor] PDF export failed:', exportError);
            toast(Na__LeCfg__GetLabel('PdfFailedMessage', 'PDF export failed - see console.'), true);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor PDF Exporter API
    // ------------------------------------------------------------
    export {
        Na__LePdf__EnsureJsPdf,
        Na__LePdf__LoadLibrary,                                                 // <-- jsPDF ALONE, for the statement PDF: it draws no text, so the Open Sans cuts EnsureJsPdf also fetches would be half a megabyte a reader never uses
        Na__LePdf__BuildDocument,
        Na__LePdf__ExportSheet
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
