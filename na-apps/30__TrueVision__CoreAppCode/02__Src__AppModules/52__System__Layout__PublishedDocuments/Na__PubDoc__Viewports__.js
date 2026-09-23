// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - VIEWPORTS AND THE TIER LADDER
// =============================================================================
//
// FILE       : Na__PubDoc__Viewports__.js
// NAMESPACE  : Na__PubVp
// MODULE     : Published Documents - Viewports and the Tier Ladder
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Place two things per viewport - one flattened picture and one paint-ready SVG - and swap the picture's size as the sheet zooms
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - TWO THINGS PER VIEWPORT, IN THIS ORDER: the flattened raster, then the
//   linework over it. Everything that used to be a separate layer on the device -
//   base image, depth fog, whitecard, the enhancement - was composited into the
//   raster when it was baked, so there is one decode and no blending. An opaque
//   picture also cannot show the black fringe or the inverted viewport that
//   layered transparency produces on some devices.
// - THE LADDER IS A PIXEL SIZE, NOT A CODEC. A sheet opens fitted, so it opens on
//   the smallest tier - about a fiftieth of the memory the authoring renderer
//   spends on the same viewport, and nothing is computed to get it. Zooming past
//   a tier's ceiling swaps in the next size up and DROPS the one below: holding
//   two tiers of one viewport is how a cache becomes a leak.
// - A DECODE THAT FAILS IS NOT RETRIED. The reader stays on the tier below and
//   says so. Retrying a decode that failed for want of memory fails again, and
//   trying is what takes the page down - which is precisely the fault this whole
//   system exists to remove.
// - THERE IS AN AGGREGATE BYTE BUDGET, counted from the manifest as width x
//   height x 4, because that is the figure a phone cares about. It is a budget in
//   BYTES and never a count of sheets: counting sheets is what let the authoring
//   viewer hold twenty-four of them.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with Phase 2 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import {
        Na__PubPaint__Sink, Na__PubPaint__Done, Na__PubPaint__Group, Na__PubPaint__GroupEnd,
        Na__PubPaint__Rect, Na__PubPaint__Image, Na__PubPaint__Text, Na__PubPaint__ClipRect,
        Na__PubPaint__Num
    } from './Na__PubDoc__Paint__.js';

    import {
        Na__PubSchema__ScreenTiers, Na__PubSchema__TierForZoom, Na__PubSchema__TierForDensity
    } from '../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Paths__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State - What Is Decoded Right Now
// -----------------------------------------------------------------------------
//
// One entry per viewport on screen, holding which tier it is showing and what
// that tier costs decoded. Cleared when a document is left, which is the only
// eviction policy there needs to be: a reader looks at one document at a time.
//
// -----------------------------------------------------------------------------

    const Na__PubVp__Showing = new Map();                                         // <-- viewportKey -> { TierId, Bytes, Failed:Set }
    let   Na__PubVp__Budget  = 134217728;                                          // <-- 128 MB, overridden from the reader config

    // FUNCTION | Set the Aggregate Decoded-Bytes Ceiling
    // ------------------------------------------------------------
    function Na__PubVp__SetBudget(bytes) {
        const number = Number(bytes);
        if (Number.isFinite(number) && number > 0) Na__PubVp__Budget = number;
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget Every Viewport of the Document Being Left
    // ------------------------------------------------------------
    function Na__PubVp__Release(documentId) {
        if (!documentId) { Na__PubVp__Showing.clear(); return; }
        for (const key of [ ...Na__PubVp__Showing.keys() ]) {
            if (key.indexOf(documentId + '/') === 0) Na__PubVp__Showing.delete(key);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Reader Is Holding, Decoded
    // ------------------------------------------------------------
    function Na__PubVp__HeldBytes() {
        let total = 0;
        for (const entry of Na__PubVp__Showing.values()) total += entry.Bytes || 0;
        return total;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Tier Choice
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Rasters a Viewport Published, by Tier Id
    // ------------------------------------------------------------
    function Na__PubVp__RasterMap(viewport) {
        const map = new Map();
        const list = viewport && viewport['Viewport__Rasters'];
        if (Array.isArray(list)) {
            for (const raster of list) {
                if (raster && raster['Tier__Id']) map.set(String(raster['Tier__Id']), raster);
            }
        }
        return map;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Tier of a Viewport Costs Decoded
    // ------------------------------------------------------------
    function Na__PubVp__Cost(raster) {
        const w = Number(raster && raster['Tier__PixelW']);
        const h = Number(raster && raster['Tier__PixelH']);
        return (Number.isFinite(w) && Number.isFinite(h)) ? (w * h * 4) : 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Tier a Viewport Should Show at This Zoom
    // ------------------------------------------------------------
    // Walks DOWN from the tier the zoom asks for until one is found that the
    // viewport actually published, that has not already failed to decode, and
    // that fits in what is left of the budget. Returning the smallest rather
    // than nothing is deliberate: a slightly soft drawing is a drawing, and a
    // reader that refused to show anything would be the old fault in a new coat.
    // ------------------------------------------------------------
    function Na__PubVp__ChooseTier(documentId, viewport, zoom, density) {
        const rasters = Na__PubVp__RasterMap(viewport);
        if (rasters.size === 0) return null;

        const key     = documentId + '/' + viewport['Viewport__Id'];
        const held    = Na__PubVp__Showing.get(key);
        const failed  = (held && held.Failed) || new Set();
        // DENSITY WHEN KNOWN: the device pixels one paper millimetre covers on
        // screen decides the tier exactly, on any device. A bare zoom factor is
        // the fallback for a caller that has nothing better.
        const wanted  = (Number(density) > 0) ? Na__PubSchema__TierForDensity(density) : Na__PubSchema__TierForZoom(zoom);
        const ladder  = Na__PubSchema__ScreenTiers();
        const ceiling = ladder.findIndex((one) => wanted && one.id === wanted.id);
        const spare   = Na__PubVp__Budget - (Na__PubVp__HeldBytes() - ((held && held.Bytes) || 0));

        for (let i = (ceiling === -1 ? ladder.length - 1 : ceiling); i >= 0; i--) {
            const tier   = ladder[i];
            const raster = rasters.get(tier.id);
            if (!raster || failed.has(tier.id)) continue;
            if (Na__PubVp__Cost(raster) > spare && i > 0) continue;                // <-- Over budget: try smaller
            return { Tier : tier, Raster : raster, Bytes : Na__PubVp__Cost(raster) };
        }
        // Everything is either absent or has failed. The smallest published tier
        // is the last thing worth trying.
        for (const tier of ladder) {
            const raster = rasters.get(tier.id);
            if (raster && !failed.has(tier.id)) return { Tier : tier, Raster : raster, Bytes : Na__PubVp__Cost(raster) };
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remember That a Tier Is Now Showing
    // ------------------------------------------------------------
    function Na__PubVp__Held(documentId, viewportId, tierId, bytes) {
        const key   = documentId + '/' + viewportId;
        const entry = Na__PubVp__Showing.get(key) || { Failed : new Set() };
        entry.TierId = tierId;
        entry.Bytes  = bytes || 0;
        Na__PubVp__Showing.set(key, entry);
        return entry;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remember That a Tier Could Not Be Decoded, and Never Ask Again
    // ------------------------------------------------------------
    function Na__PubVp__Failed(documentId, viewportId, tierId) {
        const key   = documentId + '/' + viewportId;
        const entry = Na__PubVp__Showing.get(key) || { Failed : new Set() };
        entry.Failed = entry.Failed || new Set();
        entry.Failed.add(String(tierId));
        Na__PubVp__Showing.set(key, entry);
        return entry;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Tier a Viewport Is Showing
    // ------------------------------------------------------------
    function Na__PubVp__ShowingTier(documentId, viewportId) {
        const entry = Na__PubVp__Showing.get(documentId + '/' + viewportId);
        return entry ? (entry.TierId || null) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Painting a Viewport
// -----------------------------------------------------------------------------

    // FUNCTION | Paint Every Viewport of a Document
    // ------------------------------------------------------------
    // The raster goes in as an <image> so the browser owns the fetch and the
    // decode; the linework goes in as an <image> pointing at the published SVG,
    // inside the same clipped group, so the two cannot drift apart when the sheet
    // is zoomed.
    //
    // WHY THE LINEWORK IS AN <image> AND NOT INLINED: the published SVG is one
    // file of about five <path> elements. Referencing it keeps those paths out of
    // the sheet's own DOM entirely - the browser rasterises them on its own
    // compositor thread and at whatever scale the sheet is shown - so a 41,000
    // segment plan costs the page one element. Inlining would put the paths in
    // the document, which is affordable but pointless: nothing in the reader ever
    // needs to address an individual projected edge.
    // ------------------------------------------------------------
    function Na__PubVp__Paint(viewports, context) {
        if (!Array.isArray(viewports) || viewports.length === 0) return '';
        const sink = Na__PubPaint__Sink();
        const zoom = Number(context.Zoom) || 1;

        for (const viewport of viewports) {
            const id    = viewport['Viewport__Id'];
            const frame = viewport['Viewport__FrameMm'];
            if (!id || !frame) continue;

            const x = Number(frame['X']) || 0;
            const y = Number(frame['Y']) || 0;
            const w = Number(frame['WidthMm']) || 0;
            const h = Number(frame['HeightMm']) || 0;
            if (w <= 0 || h <= 0) continue;

            // THE PICTURE'S OWN RECTANGLE inside the frame. A 3D viewport's
            // picture can be a window of a larger render, so it is not always
            // the frame; a 2D picture always is.
            const rect = viewport['Viewport__PictureRectMm'] || {};
            const px = x + (Number(rect['X']) || 0);
            const py = y + (Number(rect['Y']) || 0);
            const pw = Number(rect['WidthMm'])  || w;
            const ph = Number(rect['HeightMm']) || h;

            // A TURNED VIEWPORT IS TURNED HERE, about the middle of its frame,
            // with the picture and the linework baked in the viewport's own
            // unrotated space. Baking the rotation into the pixels would make
            // every dimension attached to the viewport wrong.
            const spin = Number(viewport['Viewport__RotationDeg']) || 0;
            const transform = spin
                ? ('rotate(' + Na__PubPaint__Num(spin) + ' ' + Na__PubPaint__Num(x + w / 2) + ' ' + Na__PubPaint__Num(y + h / 2) + ')')
                : null;

            const safeId = String(id).replace(/[^A-Za-z0-9_-]/g, '');
            const clipId = Na__PubPaint__ClipRect(context.Defs, (context.DefPrefix || 'na') + '-clip-' + safeId, x, y, w, h);

            Na__PubPaint__Group(sink, {
                Class     : 'na-pubdoc__viewport',
                Id        : id,
                Kind      : 'viewport',
                Transform : transform
            });
            sink.push('<g clip-path="url(#' + clipId + ')">');

            const chosen = Na__PubVp__ChooseTier(context.DocumentId, viewport, zoom, context.Density);
            if (chosen) {
                const href = context.Url(context.Resolve(viewport, chosen.Raster['Tier__File']));
                if (href) {
                    Na__PubPaint__Image(sink, px, py, pw, ph, href, {
                        Id      : id + '__raster',
                        Class   : 'na-pubdoc__viewport-raster',
                        Aspect  : 'none'
                    });
                    Na__PubVp__Held(context.DocumentId, id, chosen.Tier.id, chosen.Bytes);
                }
            } else if (viewport['Viewport__BaseImage'] !== false) {
                // A PICTURE WAS EXPECTED AND THERE IS NONE. The frame is drawn
                // empty rather than left as a hole, so it is obvious something
                // belongs there. A vector-only viewport (Viewport__BaseImage
                // false) has no picture by design and shows the paper.
                Na__PubPaint__Rect(sink, x, y, w, h, {
                    FillColour : '#f4f5f6', StrokeColour : '#d8dcde', StrokePt : 0.35,
                    Class : 'na-pubdoc__viewport-missing'
                });
            }

            // THE FOG MASK, where the drawing has depth fog. On paper the fog is
            // painted OVER the lines, so the linework is masked by an opaque
            // greyscale copy of it at the same tier as the picture: white keeps
            // a line, darker fades it. No alpha channel is involved anywhere.
            let maskAttr = '';
            const masks = viewport['Viewport__FogMasks'];
            if (chosen && Array.isArray(masks) && masks.length) {
                const mask = masks.find((one) => one['Tier__Id'] === chosen.Tier.id) || masks[masks.length - 1];
                const maskHref = mask ? context.Url(context.Resolve(viewport, mask['Tier__File'])) : null;
                if (maskHref) {
                    const maskId = (context.DefPrefix || 'na') + '-fog-' + safeId;
                    context.Defs.push('<mask id="' + maskId + '" maskUnits="userSpaceOnUse" x="' + Na__PubPaint__Num(x) + '" y="' + Na__PubPaint__Num(y) +
                                      '" width="' + Na__PubPaint__Num(w) + '" height="' + Na__PubPaint__Num(h) + '">');
                    Na__PubPaint__Image(context.Defs, px, py, pw, ph, maskHref, { Aspect : 'none' });
                    context.Defs.push('</mask>');
                    maskAttr = ' mask="url(#' + maskId + ')"';
                }
            }

            const vector = viewport['Viewport__Vector'];
            if (vector && vector['Vector__File']) {
                const href = context.Url(context.Resolve(viewport, vector['Vector__File']));
                if (href) {
                    if (maskAttr) sink.push('<g' + maskAttr + '>');
                    Na__PubPaint__Image(sink, x, y, w, h, href, {
                        Id     : id + '__linework',
                        Class  : 'na-pubdoc__viewport-linework',
                        Aspect : 'none'
                    });
                    if (maskAttr) sink.push('</g>');
                }
            }

            // SCENE MARKUP, in the frame's own millimetres, inside the clip and
            // the turn - the PDF draws it inside the viewport's graphics state.
            if (typeof viewport['Viewport__SceneSvg'] === 'string' && viewport['Viewport__SceneSvg']) {
                sink.push('<g class="na-pubdoc__viewport-scene" transform="translate(' + Na__PubPaint__Num(x) + ' ' + Na__PubPaint__Num(y) + ')">' +
                          (context.Tokens ? context.Tokens(viewport['Viewport__SceneSvg']) : viewport['Viewport__SceneSvg']) + '</g>');
            }

            sink.push('</g>');

            if (viewport['Viewport__ShowFrame'] === true) {
                Na__PubPaint__Rect(sink, x, y, w, h, {
                    FillColour : null, StrokeColour : '#9aa4a9', StrokePt : 0.25,
                    Class : 'na-pubdoc__viewport-frame'
                });
            }

            Na__PubVp__ScaleBar(sink, viewport);
            Na__PubPaint__GroupEnd(sink);

            // THE FRAME AND CAPTION, as the editor drew them, in page
            // coordinates and OUTSIDE the turn and the clip - the PDF draws them
            // straight after the viewport, and they carry their own turn.
            if (typeof viewport['Viewport__FrameSvg'] === 'string' && viewport['Viewport__FrameSvg']) {
                sink.push('<g class="na-pubdoc__viewport-framemarks">' +
                          (context.Tokens ? context.Tokens(viewport['Viewport__FrameSvg']) : viewport['Viewport__FrameSvg']) + '</g>');
            }
        }
        return Na__PubPaint__Done(sink);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Viewport's Published Scale Bar
    // ------------------------------------------------------------
    // Published as the bar it prints as - positions, divisions and labels all
    // resolved - so the reader draws rectangles and strings and does not know
    // what a scale is.
    // ------------------------------------------------------------
    function Na__PubVp__ScaleBar(sink, viewport) {
        const bar = viewport['Viewport__ScaleBar'];
        if (!bar || bar['ScaleBar__Shown'] !== true) return;

        const x      = Number(bar['ScaleBar__XMm']) || 0;
        const y      = Number(bar['ScaleBar__YMm']) || 0;
        const length = Number(bar['ScaleBar__LengthMm']) || 0;
        const marks  = bar['ScaleBar__Divisions'];
        const labels = bar['ScaleBar__Labels'];
        if (length <= 0 || !Array.isArray(marks) || marks.length < 2) return;

        const span   = Number(marks[marks.length - 1]) - Number(marks[0]) || 1;
        const height = 1.4;

        Na__PubPaint__Group(sink, { Class : 'na-pubdoc__scalebar' });
        for (let i = 0; i < marks.length - 1; i++) {
            const x0 = x + ((Number(marks[i])     - Number(marks[0])) / span) * length;
            const x1 = x + ((Number(marks[i + 1]) - Number(marks[0])) / span) * length;
            Na__PubPaint__Rect(sink, x0, y, x1 - x0, height, {
                FillColour   : (i % 2 === 0) ? '#172b3a' : '#ffffff',
                StrokeColour : '#172b3a',
                StrokePt     : 0.25
            });
        }
        if (Array.isArray(labels)) {
            for (let i = 0; i < labels.length && i < marks.length; i++) {
                const at = x + ((Number(marks[i]) - Number(marks[0])) / span) * length;
                Na__PubPaint__Text(sink, at, y + height + 2.2, [ labels[i] ], {
                    SizeMm : 1.8, Align : 'centre', Colour : '#172b3a', Class : 'na-pubdoc__scalebar-label'
                });
            }
        }
        Na__PubPaint__GroupEnd(sink);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubVp__Paint,
        Na__PubVp__ChooseTier,
        Na__PubVp__ShowingTier,
        Na__PubVp__Held,
        Na__PubVp__Failed,
        Na__PubVp__Release,
        Na__PubVp__HeldBytes,
        Na__PubVp__SetBudget
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
