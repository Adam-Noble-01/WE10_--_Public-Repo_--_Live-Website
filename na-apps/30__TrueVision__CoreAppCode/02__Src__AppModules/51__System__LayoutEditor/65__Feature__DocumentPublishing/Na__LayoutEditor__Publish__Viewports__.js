// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DOCUMENT PUBLISHING - VIEWPORTS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Publish__Viewports__.js
// NAMESPACE  : Na__LePubVp
// MODULE     : Layout Editor - Document Publishing - Viewports
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Bake one viewport into its published files - the flattened picture at every tier, the paint-ready linework, the fog mask, and its markup
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A NAME HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - EVERY PIXEL AND EVERY LINE COMES FROM THE PDF EXPORTER'S OWN SOURCES.
//   The picture is Na__LeVp2d__RenderForExport - the composited whitecard,
//   enhancement and weights the PDF places - and the fog is
//   Na__LeVp2d__RenderFogForExport; the linework is Na__LeVp2d__EnsureLinework
//   styled by Na__LeVp2d__StyleBands and transformed exactly as
//   the PDF exporter's own DrawLinework transforms it; a 3D viewport is
//   Na__LeVp3d__RenderForExport placed in Na__LeVp3d__ExportRectMm. What a
//   reader sees is what the PDF prints, because it was made by the same calls.
// - TWO THINGS PER VIEWPORT, PLUS A MASK WHERE THERE IS FOG. The picture is one
//   opaque image with the fog composited in; the linework is one paint-ready SVG
//   over it. Where the drawing has depth fog, the fog also fades the LINES on
//   paper, so an opaque greyscale mask of it is published and the reader applies
//   it to the linework. Nothing published carries an alpha channel.
// - THE LINEWORK SVG IS IN THE VIEWPORT'S OWN FRAME: paper millimetres from its
//   top-left corner, viewBox 0 0 width height. The reader positions it with one
//   translate and turns it with the frame, exactly as the frame element turns on
//   screen and the PDF turns its graphics state.
// - SITE PLANS HAVE NO RENDERED PICTURE. Their fills and hatches are vector
//   data, so they are built as the editor's own primitives, rasterised once here
//   at print size into the picture, and the linework goes over them as for any
//   other drawing. Each face is one primitive carrying its holes, filled
//   even-odd, so a lake in a field is left bare of the field's wash and hatch
//   exactly as the screen leaves it.
// - ONE HASH NAMES EVERY FILE OF A VIEWPORT, taken over ALL of that viewport's
//   baked bytes. Any change anywhere - a line, a tier, the mask - gives every
//   file a new name, so a name can never mean two different files and all of
//   them can be cached immutably.
// - A POINT CLOUD VIEWPORT PUBLISHES A SECOND PICTURE: the same decks with
//   the SketchUp point cloud laid in at FULL strength, where the PDF lays it
//   (Na__LeVp2d__PointCloudForPublish, CloudDecks), at every screen tier.
//   The reader lays it over the plain picture at the viewport's opacity, so
//   the drawing opens as it prints, and a client's slider moves only that
//   opacity. Opaque like the plain picture: compositing is linear in the
//   point cloud's strength, so a crossfade of two opaque pictures is exact
//   and no alpha channel is ever published.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.2.0
// - Point cloud viewports are published WITH their point cloud (Adam: the
//   client view of JW02 showed none). Bake adds Viewport__PointCloud to the
//   element - PointCloud__Opacity, PointCloud__OverLinework,
//   PointCloud__Rasters and the datum as PointCloud__DatumSvg - and the
//   second picture's tiers to the manifest. A point cloud that cannot be
//   drawn is a warning, never a failed publish.
//
// 23-Sep-2026 - Version 1.1.0
// - SitePlanSvg paints each site plan face as ONE holed polyline (outer ring
//   plus its inner rings, through Na__LeRings__FacesFromRings), filled
//   even-odd, instead of each face's outer ring alone. RB05's published D13
//   showed the Grassland tufts across the lake and the water ripples across
//   the island, which the screen - one even-odd path per layer - never did.
//   SitePlanSvg is now exported so a test can read its markup.
//
// 23-Sep-2026 - Version 1.0.0
// - Created with Phase 4 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__LeCfg__GetLineworkSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__KIND_2D, Na__LeModel__IsSitePlanViewport } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeChrome__BuildViewportFrame, Na__LeChrome__PushPolyline, Na__LeChrome__ToSvgMarkup } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeMarkup__BuildScenePrimitives } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeRings__FacesFromRings } from '../15__Core__Markup/Na__LayoutEditor__ShapeRings__.js';
    import {
        Na__LeVp2d__Describe, Na__LeVp2d__EnsureLinework, Na__LeVp2d__RenderForExport,
        Na__LeVp2d__RenderFogForExport, Na__LeVp2d__StyleBands, Na__LeVp2d__SitePlanDrawing,
        Na__LeVp2d__PointCloudForPublish
    } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeVp3d__RenderForExport, Na__LeVp3d__ExportRectMm } from '../20__System__Viewports/Na__LayoutEditor__Viewport3d__.js';

    import {
        Na__PubSchema__VectorPath, Na__PubSchema__RasterPath, Na__PubSchema__MaskPath,
        Na__PubSchema__PointCloudPath, Na__PubSchema__DocumentFolder, Na__PubSchema__TierPixels
    } from '../../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Paths__.js';

    import {
        Na__LePubRas__Canvas, Na__LePubRas__Load, Na__LePubRas__Free,
        Na__LePubRas__Sha, Na__LePubRas__ApplyFog, Na__LePubRas__FromSvg,
        Na__LePubRas__Ladder
    } from './Na__LayoutEditor__Publish__Raster__.js';
    import { Na__LePubSheet__Portable } from './Na__LayoutEditor__Publish__Sheet__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    const Na__LePubVp__PAPER = '#ffffff';
    const Na__LePubVp__SVG_BODY = /^<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Number Short Enough to Write Thousands of Times
    // ------------------------------------------------------------
    function Na__LePubVp__N(value) {
        const fixed = Number(value).toFixed(3);
        return fixed.indexOf('.') === -1 ? fixed : fixed.replace(/\.?0+$/, '');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Primitive List as Svg Body, in a Given Box
    // ------------------------------------------------------------
    function Na__LePubVp__SvgBody(primitives, widthMm, heightMm) {
        if (!Array.isArray(primitives) || primitives.length === 0) return '';
        const whole = Na__LeChrome__ToSvgMarkup(primitives, widthMm, heightMm, '');
        const match = Na__LePubVp__SVG_BODY.exec(whole);
        return match ? match[1] : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Escape an Attribute
    // ------------------------------------------------------------
    function Na__LePubVp__Esc(text) {
        return String(text == null ? '' : text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Linework
// -----------------------------------------------------------------------------

    // FUNCTION | The Paint-Ready Linework Svg of One 2D Viewport
    // ------------------------------------------------------------
    // Byte for byte the lines the PDF exporter's DrawLinework draws: the same bands,
    // the same widths and dashes, the same segments skipped for being too short
    // or wholly outside the frame - but written in the frame's own millimetres
    // (the PDF adds the frame's X and Y; here the reader's translate does).
    // One <path> per band, however many segments: 41,000 segments are still a
    // handful of DOM nodes.
    // ------------------------------------------------------------
    function Na__LePubVp__LineworkSvg(sheet, viewport, described, classes, siteRules, documentId) {
        if (!classes) return null;
        const win   = described.window;
        const D     = win.Denominator;
        const frame = viewport.Viewport__FrameMm;
        const W = frame.WidthMm, H = frame.HeightMm;
        const minLen = Na__LeCfg__GetLineworkSetup().minSegmentPaperMm;
        const showHidden = viewport.Viewport__Styles && viewport.Viewport__Styles.hiddenLines === true;
        const viewportPt = sheet && sheet.Sheet__Lineweights ? sheet.Sheet__Lineweights.ViewportPt : null;
        const bands = Na__LeVp2d__StyleBands(viewport, viewportPt, classes, showHidden, siteRules);

        let segmentCount = 0;
        const paths = [];
        bands.forEach((band) => {
            const segments = classes[band.className];
            if (!segments || segments.length < 4) return;
            const count = band.indices ? band.indices.length : Math.floor(segments.length / 4);
            const d = [];
            for (let k = 0; k < count; k++) {
                const i  = (band.indices ? band.indices[k] : k) * 4;
                const x1 = (segments[i]     - win.OriginX) / D, y1 = (segments[i + 1] - win.OriginY) / D;
                const x2 = (segments[i + 2] - win.OriginX) / D, y2 = (segments[i + 3] - win.OriginY) / D;
                if (Math.abs(x2 - x1) < minLen && Math.abs(y2 - y1) < minLen) continue;
                if ((x1 < 0 && x2 < 0) || (x1 > W && x2 > W) || (y1 < 0 && y2 < 0) || (y1 > H && y2 > H)) continue;
                d.push('M' + Na__LePubVp__N(x1) + ',' + Na__LePubVp__N(y1) + 'L' + Na__LePubVp__N(x2) + ',' + Na__LePubVp__N(y2));
            }
            if (d.length === 0) return;
            segmentCount += d.length;
            const dash = (Array.isArray(band.dashMm) && band.dashMm.length) ? (' stroke-dasharray="' + band.dashMm.map(Na__LePubVp__N).join(' ') + '"') : '';
            paths.push('<path data-na-class="' + Na__LePubVp__Esc(band.className) + '" fill="none" stroke="' + Na__LePubVp__Esc(band.colour) +
                       '" stroke-width="' + Na__LePubVp__N(band.widthMm) + '" stroke-linecap="round" stroke-linejoin="round"' + dash +
                       ' d="' + d.join('') + '"/>');
        });
        if (paths.length === 0) return null;

        const markup = '<svg xmlns="http://www.w3.org/2000/svg" width="' + Na__LePubVp__N(W) + 'mm" height="' + Na__LePubVp__N(H) + 'mm"' +
            ' viewBox="0 0 ' + Na__LePubVp__N(W) + ' ' + Na__LePubVp__N(H) + '"' +
            ' data-na-document="' + Na__LePubVp__Esc(documentId) + '" data-na-viewport="' + Na__LePubVp__Esc(viewport.Viewport__Id) + '"' +
            ' data-na-space="paper-mm, viewport frame, origin top-left, x right, y down" data-na-segments="' + segmentCount + '">' +
            paths.join('') + '</svg>';
        return { Markup : markup, Paths : paths.length, Segments : segmentCount };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Site Plan Picture
// -----------------------------------------------------------------------------

    // FUNCTION | A Site Plan Viewport's Fills and Hatches as Svg, in Its Own Frame
    // ------------------------------------------------------------
    // Mirrors Na__LePdf__DrawSitePlanFills and Na__LePdf__DrawSitePlanPatterns
    // (neither is exported), building the SAME primitives and handing them to
    // the editor's own SVG converter - the hatch through the same Hatch block a
    // vector shape carries, so it paints with the same pattern code.
    // ONE PRIMITIVE PER FACE, HOLES AND ALL. A face's rings come from the store
    // as its outer loop and its inner loops; the screen paints them as one
    // even-odd path, so a lake is a hole in the field. FacesFromRings gives the
    // same face as one holed polyline, which the converter fills even-odd -
    // the wash and the hatch alike stop at every hole. Painting the outer ring
    // alone (as this did until 1.1.0) hatched grass across the lake and
    // ripples across its island.
    // ------------------------------------------------------------
    function Na__LePubVp__SitePlanSvg(viewport, described, drawing) {
        const win   = described.window;
        const D     = win.Denominator;
        const frame = viewport.Viewport__FrameMm;
        const primitives = [];
        const toLocal = (x, y) => [ (x - win.OriginX) / D, (y - win.OriginY) / D ];
        (drawing.fills || []).forEach((fill) => {
            Na__LeRings__FacesFromRings(fill.rings, toLocal).forEach((face) => {
                Na__LeChrome__PushPolyline(primitives, face.points, null, 0, fill.hex, true, null, { fillOpacity : fill.opacity, holes : face.holes });
            });
        });
        (drawing.patterns || []).forEach((entry) => {
            const key = entry.pattern && entry.pattern.Pattern__Key;
            if (!key) return;
            Na__LeRings__FacesFromRings(entry.rings, toLocal).forEach((face) => {
                Na__LeChrome__PushPolyline(primitives, face.points, null, 0, null, true, null, {
                    holes : face.holes,
                    hatch : { Hatch__PatternKey : key, Hatch__Scale : entry.scale, Hatch__RotationDeg : entry.rotationDeg,
                              Hatch__Colour : entry.colour, Hatch__StrokePt : entry.strokePt }
                });
            });
        });
        if (primitives.length === 0) return null;
        return Na__LeChrome__ToSvgMarkup(primitives, frame.WidthMm, frame.HeightMm, '');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Point Cloud Picture
// -----------------------------------------------------------------------------

    // FUNCTION | A Point Cloud Viewport's Second Picture: Every Deck, the Point Cloud at Full Strength Among Them
    // ------------------------------------------------------------
    // decks : the viewport's layers in the order the PDF paints them, each an
    //         image or canvas drawn across the whole frame, or an SVG's markup
    //         (the linework, a site plan's fills), rasterised here at this
    //         size. A missing deck (null) is skipped.
    // Painted over the paper, so the picture is opaque like every other
    // published picture. The reader lays it over the plain picture at the
    // viewport's opacity, o: plain x (1 - o) + this x o is EXACTLY the
    // drawing with its point cloud at o, wherever the point cloud sits in
    // the stack, because every deck is laid over the ones below it and that
    // is linear in the point cloud's strength.
    // ------------------------------------------------------------
    async function Na__LePubVp__CloudPicture(width, height, decks) {
        const out = Na__LePubRas__Canvas(width, height, true);
        out.context.fillStyle = Na__LePubVp__PAPER;
        out.context.fillRect(0, 0, width, height);
        for (const deck of decks) {
            if (!deck) continue;
            if (typeof deck === 'string') {
                const url = URL.createObjectURL(new Blob([ deck ], { type : 'image/svg+xml' }));
                try { out.context.drawImage(await Na__LePubRas__Load(url), 0, 0, width, height); }
                finally { URL.revokeObjectURL(url); }
            } else {
                out.context.drawImage(deck, 0, 0, width, height);
            }
        }
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Decks of a Point Cloud Viewport, in the PDF's Order
    // ------------------------------------------------------------
    // Na__LePdf__DrawViewport's order exactly. A drawing: underlay, the point
    // cloud with Linework On Top, linework, fog, the point cloud otherwise. A
    // site plan: the point cloud with Linework On Top (under every deck),
    // fills and patterns, linework, the point cloud otherwise. The linework
    // is in this picture only where the point cloud goes over it; under it,
    // the reader's own linework is drawn over this picture.
    // ------------------------------------------------------------
    function Na__LePubVp__CloudDecks(cloud, layers) {
        const over = !cloud.lineworkOnTop;
        if (layers.site) {
            return over ? [ layers.fills, layers.lines, cloud.canvas ] : [ cloud.canvas, layers.fills ];
        }
        return over ? [ layers.underlay, layers.lines, layers.fog, cloud.canvas ] : [ layers.underlay, cloud.canvas, layers.fog ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bake One Viewport
// -----------------------------------------------------------------------------

    // FUNCTION | Bake One Viewport Into Its Published Files
    // ------------------------------------------------------------
    // Returns {
    //   Element  : the Elements__Viewports entry (names filled in),
    //   Manifest : the Files__Viewports entry,
    //   Files    : [ { Path (published-root relative), Blob } ],
    //   Assets   : [ { Path, Blob } ] - shared images its markup references,
    //   Warnings : [ string ]
    // }
    // ------------------------------------------------------------
    async function Na__LePubVp__Bake(sheet, viewport, documentId, report) {
        const say      = (typeof report === 'function') ? report : () => {};
        const frame    = viewport.Viewport__FrameMm;
        const warnings = [];
        const assets   = [];
        const is2d     = viewport.Viewport__Kind === Na__LeModel__KIND_2D;
        const isSite   = is2d && Na__LeModel__IsSitePlanViewport(viewport);

        let picture   = null;                                                     // <-- An opaque canvas at print size, or null
        let pictureMm = { X : 0, Y : 0, WidthMm : frame.WidthMm, HeightMm : frame.HeightMm };
        let maskPair  = null;
        let linework  = null;
        let sceneSvg  = '';
        let cloudPair = null;                                                     // <-- A point cloud viewport's second picture, or null
        let cloudInfo = null;                                                     // <-- { Opacity, OverLinework, DatumSvg } beside it

        // THE POINT CLOUD, where the viewport lays one over its drawing: the
        // same picture with the point cloud in it at full strength, size the
        // plain picture's (or the export level's when there is none). Never
        // fails the publish: a point cloud is cosmetic, as in the PDF.
        const bakeCloud = async (size, layers) => {
            if (!viewport.Viewport__PointCloud) return;
            say('point cloud');
            let cloud = null;
            try {
                cloud = await Na__LeVp2d__PointCloudForPublish(viewport, size ? size.w : 0, size ? size.h : 0);
            } catch (error) {
                console.warn('[TrueVision3D LayoutEditor] A point cloud was left out of a published drawing.', error);
            }
            if (!cloud) {
                if (!viewport.Viewport__PointCloud.PointCloud__Hidden) warnings.push(viewport.Viewport__Id + ': its point cloud could not be drawn, so it is published without one.');
                return;
            }
            try {
                cloudPair = await Na__LePubVp__CloudPicture(cloud.canvas.width, cloud.canvas.height, Na__LePubVp__CloudDecks(cloud, layers));
                cloudInfo = { Opacity : cloud.opacity, OverLinework : !cloud.lineworkOnTop,
                              DatumSvg : Na__LePubVp__SvgBody(cloud.datum, frame.WidthMm, frame.HeightMm) };   // <-- Frame-local, as the PDF offsets it
            } finally {
                Na__LePubRas__Free(cloud.canvas);
            }
        };

        if (is2d) {
            const described = Na__LeVp2d__Describe(viewport);

            if (isSite) {
                say('site plan fills');
                const drawing = await Na__LeVp2d__SitePlanDrawing(viewport);
                if (!drawing) warnings.push(viewport.Viewport__Id + ': the site plan drawing could not be built.');
                else {
                    const svg   = Na__LePubVp__SitePlanSvg(viewport, described, drawing);
                    const print = Na__LePubVp__PrintSize(frame);
                    if (svg) {
                        picture = await Na__LePubRas__FromSvg(svg, print.PixelW, print.PixelH, Na__LePubVp__PAPER);
                    }
                    if (drawing.paintLines !== false) {
                        linework = Na__LePubVp__LineworkSvg(sheet, viewport, described, drawing.classes, drawing.siteRules, documentId);
                    }
                    await bakeCloud({ w : print.PixelW, h : print.PixelH }, { site : true, fills : svg, lines : linework ? linework.Markup : null });
                }
            } else if (!described.definition) {
                warnings.push(viewport.Viewport__Id + ': its drawing source is missing, so it is published empty.');
            } else {
                say('picture');
                const underlay = await Na__LeVp2d__RenderForExport(viewport);   // <-- null for a vector-only viewport
                say('fog');
                const fog      = await Na__LeVp2d__RenderFogForExport(viewport);   // <-- null unless the drawing has depth fog
                const image    = (underlay && underlay.dataUrl) ? await Na__LePubRas__Load(underlay.dataUrl) : null;
                const fogImage = (fog && fog.dataUrl) ? await Na__LePubRas__Load(fog.dataUrl) : null;

                if (image) {
                    picture = Na__LePubRas__Canvas(image.naturalWidth, image.naturalHeight, true);
                    picture.context.fillStyle = Na__LePubVp__PAPER;
                    picture.context.fillRect(0, 0, picture.canvas.width, picture.canvas.height);
                    picture.context.drawImage(image, 0, 0);
                }
                if (fogImage) {
                    if (!picture) {                                               // <-- Fog over bare paper: the paper is the picture
                        picture = Na__LePubRas__Canvas(fogImage.naturalWidth, fogImage.naturalHeight, true);
                        picture.context.fillStyle = Na__LePubVp__PAPER;
                        picture.context.fillRect(0, 0, picture.canvas.width, picture.canvas.height);
                    }
                    const applied = Na__LePubRas__ApplyFog(picture, fogImage);
                    maskPair = applied.Mask;
                }

                if (!viewport.Viewport__Styles || viewport.Viewport__Styles.projectedLinework !== false) {
                    say('linework');
                    const classes = await Na__LeVp2d__EnsureLinework(described.definition, null, false, described.modelSource);   // <-- The viewport's own design phase
                    linework = Na__LePubVp__LineworkSvg(sheet, viewport, described, classes, null, documentId);
                }

                await bakeCloud(picture ? { w : picture.canvas.width, h : picture.canvas.height } : null,
                                { site : false, underlay : image, fog : fogImage, lines : linework ? linework.Markup : null });

                if (viewport.Viewport__MarkupMode === 'scene') {
                    const scene = await Na__LePubSheet__Portable(Na__LeMarkup__BuildScenePrimitives(described), sheet, assets);
                    sceneSvg = Na__LePubVp__SvgBody(scene, frame.WidthMm, frame.HeightMm);   // <-- Frame-local, as the PDF offsets it
                }
            }
        } else {
            say('3D picture');
            const dataUrl = await Na__LeVp3d__RenderForExport(sheet, viewport);
            if (dataUrl) {
                const rect  = Na__LeVp3d__ExportRectMm(viewport);                   // <-- The picture's own rectangle inside the frame
                pictureMm   = { X : rect.X, Y : rect.Y, WidthMm : rect.WidthMm, HeightMm : rect.HeightMm };
                const image = await Na__LePubRas__Load(dataUrl);
                picture = Na__LePubRas__Canvas(image.naturalWidth, image.naturalHeight, true);
                picture.context.fillStyle = Na__LePubVp__PAPER;
                picture.context.fillRect(0, 0, picture.canvas.width, picture.canvas.height);
                picture.context.drawImage(image, 0, 0);
            } else if (viewport.Viewport__Styles && viewport.Viewport__Styles.baseImage === false) {
                // An empty frame prints empty, and publishes empty.
            } else {
                warnings.push(viewport.Viewport__Id + ': the 3D picture could not be rendered.');
            }
        }

        // THE FRAME AND ITS CAPTION, in page coordinates, as the PDF draws it
        // straight after the viewport and outside its clip.
        const framePrims = await Na__LePubSheet__Portable(Na__LeChrome__BuildViewportFrame(sheet, viewport), sheet, assets);

        // ---- THE TIERS --------------------------------------------------------
        say('tiers');
        const rasterBlobs = picture ? await Na__LePubRas__Ladder(picture.canvas, pictureMm, { Background : Na__LePubVp__PAPER }) : [];
        const maskBlobs   = maskPair ? await Na__LePubRas__Ladder(maskPair.canvas, pictureMm, { Background : '#ffffff', SkipPrint : true }) : [];
        const cloudBlobs  = cloudPair ? await Na__LePubRas__Ladder(cloudPair.canvas, pictureMm, { Background : Na__LePubVp__PAPER, SkipPrint : true }) : [];   // <-- No Print: the PDF is baked
        if (picture)   Na__LePubRas__Free(picture);
        if (maskPair)  Na__LePubRas__Free(maskPair);
        if (cloudPair) Na__LePubRas__Free(cloudPair);

        // ---- ONE HASH OVER EVERY BYTE OF THE VIEWPORT -------------------------
        const parts = [];
        for (const one of rasterBlobs) parts.push(await Na__LePubRas__Sha(one.Blob));
        for (const one of maskBlobs)   parts.push(await Na__LePubRas__Sha(one.Blob));
        for (const one of cloudBlobs)  parts.push(await Na__LePubRas__Sha(one.Blob));
        if (cloudInfo) parts.push(await Na__LePubRas__Sha('pointcloud|' + cloudInfo.DatumSvg));
        if (linework) parts.push(await Na__LePubRas__Sha(linework.Markup));
        parts.push(await Na__LePubRas__Sha(sceneSvg + '|' + JSON.stringify(framePrims.length)));
        const hash = (await Na__LePubRas__Sha(parts.join('|'))).slice(0, 10);

        // ---- NAME EVERYTHING ---------------------------------------------------
        const docFolder = Na__PubSchema__DocumentFolder(documentId);
        const local     = (path) => path.slice(docFolder.length + 1);             // <-- Manifest paths are document-relative
        const root      = (path) => path.slice(path.indexOf('/') + 1);             // <-- Upload paths are published-root relative
        const files     = [];
        const rasters   = [];
        const masks     = [];
        const manifestRasters = [];
        const manifestMasks   = [];

        for (const one of rasterBlobs) {
            const path = Na__PubSchema__RasterPath(documentId, viewport.Viewport__Id, one.Tier.id, hash);
            files.push({ Path : root(path), Blob : one.Blob });
            rasters.push({ 'Tier__Id' : one.Tier.id, 'Tier__File' : local(path), 'Tier__PixelW' : one.PixelW, 'Tier__PixelH' : one.PixelH });
            manifestRasters.push({ 'Tier__Id' : one.Tier.id, 'File__Path' : local(path), 'File__PixelW' : one.PixelW, 'File__PixelH' : one.PixelH,
                                   'File__Bytes' : one.Blob.size, 'File__DecodedBytes' : one.PixelW * one.PixelH * 4, 'File__Sha256' : hash });
        }
        for (const one of maskBlobs) {
            const path = Na__PubSchema__MaskPath(documentId, viewport.Viewport__Id, one.Tier.id, hash);
            files.push({ Path : root(path), Blob : one.Blob });
            masks.push({ 'Tier__Id' : one.Tier.id, 'Tier__File' : local(path), 'Tier__PixelW' : one.PixelW, 'Tier__PixelH' : one.PixelH });
            manifestMasks.push({ 'Tier__Id' : one.Tier.id, 'File__Path' : local(path), 'File__PixelW' : one.PixelW, 'File__PixelH' : one.PixelH,
                                 'File__Bytes' : one.Blob.size, 'File__DecodedBytes' : one.PixelW * one.PixelH * 4, 'File__Sha256' : hash });
        }
        const clouds = [];
        const manifestClouds = [];
        for (const one of cloudBlobs) {
            const path = Na__PubSchema__PointCloudPath(documentId, viewport.Viewport__Id, one.Tier.id, hash);
            files.push({ Path : root(path), Blob : one.Blob });
            clouds.push({ 'Tier__Id' : one.Tier.id, 'Tier__File' : local(path), 'Tier__PixelW' : one.PixelW, 'Tier__PixelH' : one.PixelH });
            manifestClouds.push({ 'Tier__Id' : one.Tier.id, 'File__Path' : local(path), 'File__PixelW' : one.PixelW, 'File__PixelH' : one.PixelH,
                                  'File__Bytes' : one.Blob.size, 'File__DecodedBytes' : one.PixelW * one.PixelH * 4, 'File__Sha256' : hash });
        }
        // THE POINT CLOUD BLOCK. Opacity is the strength the drawing prints its
        // point cloud at, so the reader opens on exactly the issued drawing;
        // OverLinework says whether the picture goes over the published
        // linework or under it. The datum is vectors, never faded.
        const cloudEntry = (cloudInfo && clouds.length) ? {
            'PointCloud__Opacity'      : Math.max(0, Math.min(1, Number(cloudInfo.Opacity))),
            'PointCloud__OverLinework' : cloudInfo.OverLinework,
            'PointCloud__Rasters'      : clouds,
            'PointCloud__DatumSvg'     : cloudInfo.DatumSvg
        } : null;

        let vectorEntry = null, manifestVector = null;
        if (linework) {
            const path = Na__PubSchema__VectorPath(documentId, viewport.Viewport__Id, hash);
            const blob = new Blob([ linework.Markup ], { type : 'image/svg+xml' });
            files.push({ Path : root(path), Blob : blob });
            vectorEntry    = { 'Vector__File' : local(path), 'Vector__WidthMm' : frame.WidthMm, 'Vector__HeightMm' : frame.HeightMm,
                               'Vector__PathCount' : linework.Paths, 'Vector__SegmentCount' : linework.Segments };
            manifestVector = { 'File__Path' : local(path), 'File__Bytes' : blob.size, 'File__Sha256' : hash,
                               'File__Paths' : linework.Paths, 'File__Segments' : linework.Segments };
        }

        const element = {
            'Viewport__Id'              : viewport.Viewport__Id,
            'Viewport__Kind'            : viewport.Viewport__Kind,
            'Viewport__Name'            : viewport.Viewport__Name || '',
            'Viewport__LayerId'         : viewport.Viewport__LayerId,
            'Viewport__FrameMm'         : Object.assign({}, frame),
            'Viewport__RotationDeg'     : Number(viewport.Viewport__RotationDeg) || 0,
            'Viewport__ScaleDenominator': viewport.Viewport__ScaleDenominator || null,
            'Viewport__SitePlan'        : isSite,
            'Viewport__PictureRectMm'   : pictureMm,
            'Viewport__BaseImage'       : rasters.length > 0,
            'Viewport__RasterOpaque'    : true,
            'Viewport__Rasters'         : rasters,
            'Viewport__FogMasks'        : masks,
            'Viewport__PointCloud'      : cloudEntry,
            'Viewport__Vector'          : vectorEntry,
            'Viewport__SceneSvg'        : sceneSvg,
            'Viewport__FrameSvg'        : Na__LePubVp__SvgBody(framePrims, 1, 1)   // <-- Page coordinates: the box is never used, only the body
        };
        // The frame SVG body was converted in a 1 x 1 box, which is irrelevant:
        // Na__LeChrome__ToSvgMarkup writes primitives in their own coordinates
        // and uses the box only for the wrapper it is stripped of.

        const manifest = {
            'Viewport__Id'      : viewport.Viewport__Id,
            'Viewport__Hash'    : hash,
            'Viewport__Vector'  : manifestVector,
            'Viewport__Rasters' : manifestRasters,
            'Viewport__FogMasks': manifestMasks,
            'Viewport__PointCloud' : manifestClouds.length ? manifestClouds : null
        };
        return { Element : element, Manifest : manifest, Files : files, Assets : assets, Warnings : warnings, Hash : hash };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Print Tier's Pixel Size for a Frame
    // ------------------------------------------------------------
    // Asked of the schema, never worked out here: the publisher and the reader
    // must agree about every tier's arithmetic, and the one place it lives is
    // Na__PubSchema__TierPixels.
    // ------------------------------------------------------------
    function Na__LePubVp__PrintSize(frame) {
        return Na__PubSchema__TierPixels('Print', frame.WidthMm, frame.HeightMm) || { PixelW : 1, PixelH : 1 };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__LePubVp__Bake,
        Na__LePubVp__LineworkSvg,
        Na__LePubVp__SitePlanSvg
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
