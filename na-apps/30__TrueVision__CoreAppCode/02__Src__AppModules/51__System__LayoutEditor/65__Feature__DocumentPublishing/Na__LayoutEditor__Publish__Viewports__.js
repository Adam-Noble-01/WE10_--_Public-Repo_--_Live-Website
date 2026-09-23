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
//   other drawing.
// - ONE HASH NAMES EVERY FILE OF A VIEWPORT, taken over ALL of that viewport's
//   baked bytes. Any change anywhere - a line, a tier, the mask - gives every
//   file a new name, so a name can never mean two different files and all of
//   them can be cached immutably.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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
    import {
        Na__LeVp2d__Describe, Na__LeVp2d__EnsureLinework, Na__LeVp2d__RenderForExport,
        Na__LeVp2d__RenderFogForExport, Na__LeVp2d__StyleBands, Na__LeVp2d__SitePlanDrawing
    } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeVp3d__RenderForExport, Na__LeVp3d__ExportRectMm } from '../20__System__Viewports/Na__LayoutEditor__Viewport3d__.js';

    import {
        Na__PubSchema__VectorPath, Na__PubSchema__RasterPath, Na__PubSchema__MaskPath,
        Na__PubSchema__DocumentFolder, Na__PubSchema__TierPixels
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
    // ------------------------------------------------------------
    function Na__LePubVp__SitePlanSvg(viewport, described, drawing) {
        const win   = described.window;
        const D     = win.Denominator;
        const frame = viewport.Viewport__FrameMm;
        const primitives = [];
        const toLocal = (ring) => {
            const points = [];
            for (let i = 0; i + 1 < ring.points.length; i += 2) {
                points.push([ (ring.points[i] - win.OriginX) / D, (ring.points[i + 1] - win.OriginY) / D ]);
            }
            return points;
        };
        (drawing.fills || []).forEach((fill) => {
            (fill.rings || []).forEach((ring) => {
                if (!ring.outer || !ring.points || ring.points.length < 6) return;
                Na__LeChrome__PushPolyline(primitives, toLocal(ring), null, 0, fill.hex, true, null, { fillOpacity : fill.opacity });
            });
        });
        (drawing.patterns || []).forEach((entry) => {
            const key = entry.pattern && entry.pattern.Pattern__Key;
            if (!key) return;
            (entry.rings || []).forEach((ring) => {
                if (!ring.outer || !ring.points || ring.points.length < 6) return;
                Na__LeChrome__PushPolyline(primitives, toLocal(ring), null, 0, null, true, null, {
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

        if (is2d) {
            const described = Na__LeVp2d__Describe(viewport);

            if (isSite) {
                say('site plan fills');
                const drawing = await Na__LeVp2d__SitePlanDrawing(viewport);
                if (!drawing) warnings.push(viewport.Viewport__Id + ': the site plan drawing could not be built.');
                else {
                    const svg = Na__LePubVp__SitePlanSvg(viewport, described, drawing);
                    if (svg) {
                        const print = Na__LePubVp__PrintSize(frame);
                        picture = await Na__LePubRas__FromSvg(svg, print.PixelW, print.PixelH, Na__LePubVp__PAPER);
                    }
                    if (drawing.paintLines !== false) {
                        linework = Na__LePubVp__LineworkSvg(sheet, viewport, described, drawing.classes, drawing.siteRules, documentId);
                    }
                }
            } else if (!described.definition) {
                warnings.push(viewport.Viewport__Id + ': its drawing source is missing, so it is published empty.');
            } else {
                say('picture');
                const underlay = await Na__LeVp2d__RenderForExport(viewport);   // <-- null for a vector-only viewport
                say('fog');
                const fog      = await Na__LeVp2d__RenderFogForExport(viewport);   // <-- null unless the drawing has depth fog

                if (underlay && underlay.dataUrl) {
                    const image = await Na__LePubRas__Load(underlay.dataUrl);
                    picture = Na__LePubRas__Canvas(image.naturalWidth, image.naturalHeight, true);
                    picture.context.fillStyle = Na__LePubVp__PAPER;
                    picture.context.fillRect(0, 0, picture.canvas.width, picture.canvas.height);
                    picture.context.drawImage(image, 0, 0);
                }
                if (fog && fog.dataUrl) {
                    const fogImage = await Na__LePubRas__Load(fog.dataUrl);
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
        if (picture)  Na__LePubRas__Free(picture);
        if (maskPair) Na__LePubRas__Free(maskPair);

        // ---- ONE HASH OVER EVERY BYTE OF THE VIEWPORT -------------------------
        const parts = [];
        for (const one of rasterBlobs) parts.push(await Na__LePubRas__Sha(one.Blob));
        for (const one of maskBlobs)   parts.push(await Na__LePubRas__Sha(one.Blob));
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
            'Viewport__FogMasks': manifestMasks
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
        Na__LePubVp__LineworkSvg
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
