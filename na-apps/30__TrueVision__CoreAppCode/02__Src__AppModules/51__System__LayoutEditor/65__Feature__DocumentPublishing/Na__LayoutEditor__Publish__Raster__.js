// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DOCUMENT PUBLISHING - RASTER
// =============================================================================
//
// FILE       : Na__LayoutEditor__Publish__Raster__.js
// NAMESPACE  : Na__LePubRas
// MODULE     : Layout Editor - Document Publishing - Raster
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn one print-resolution render into the whole published tier ladder, build a viewport's fog mask, and name every file by its own hash
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A NAME HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - ONE RENDER, FOUR FILES. A viewport is rendered once, at the export level the
//   PDF already uses, and every published tier is cut from that one picture:
//   Print is it resampled to the schema's exact size, Tier03, Tier02 and Tier01
//   are it scaled down. Rendering each tier separately would cost four renders
//   and would give WORSE small tiers - a picture rendered small is aliased, a
//   picture scaled down from a big one is supersampled.
// - DOWNSCALING IS DONE IN HALVINGS. A single drawImage from 8,192 px straight to
//   948 px samples a handful of source pixels per output pixel and drops fine
//   lines; halving step by step with high-quality smoothing averages them. The
//   last step lands exactly on the schema's size, so the file is always the
//   size its manifest promises.
// - THE SIZE IS THE SCHEMA'S, NOT THE RENDERER'S. The export render's size can
//   depend on the authoring machine's device pixel ratio; the published file's
//   size must not. Na__PubSchema__TierPixels says what each tier is, and the
//   render is resampled to it, so the same sheet published on two machines gives
//   the same files.
// - THE FOG IS NOT FLATTENED INTO THE PICTURE BENEATH THE LINEWORK. On paper
//   the depth fog is painted OVER the projected lines - fading far lines is the
//   whole of what it is for - so flattening it under them would leave every far
//   line at full strength. Instead the fog is composited into the picture (so
//   the picture looks right) AND turned into an opaque greyscale MASK the reader
//   applies to the linework: white where lines show fully, darker where fog
//   fades them. Out = line x (1 - fog alpha) over the fogged picture, which
//   matches the paper to within a quarter of (whitecard - fog colour) at mid
//   fog - under one per cent. Neither image has an alpha channel.
//
// INTEGRATION:
// - Na__LayoutEditor__Publish__Viewports__ is the only caller.
// - Runs on the AUTHORING machine only. It allocates print-size canvases that a
//   phone could not, which is precisely why this work happens here and never in
//   the reader.
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

    import {
        Na__PubSchema__Tiers, Na__PubSchema__TierPixels, Na__PubSchema__Get
    } from '../../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Paths__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Canvases
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Canvas of a Size, With Its 2D Context
    // ------------------------------------------------------------
    function Na__LePubRas__Canvas(width, height, opaque) {
        const canvas = document.createElement('canvas');
        canvas.width  = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        const context = canvas.getContext('2d', { alpha : !opaque, willReadFrequently : false });
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        return { canvas : canvas, context : context };
    }
    // ------------------------------------------------------------


    // FUNCTION | Decode a Data Url or Blob Url Into an Image Element
    // ------------------------------------------------------------
    function Na__LePubRas__Load(source) {
        return new Promise((resolve, reject) => {
            if (!source) { reject(new Error('No picture to load')); return; }
            const image = new Image();
            image.decoding = 'async';
            image.onload  = () => resolve(image);
            image.onerror = () => reject(new Error('A rendered picture could not be decoded'));
            image.src = source;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Release a Canvas's Pixels Now Rather Than Whenever GC Runs
    // ------------------------------------------------------------
    // A print-size canvas is a quarter of a gigabyte on a site plan. Setting the
    // size to one pixel returns the backing store at once, which matters when a
    // publish walks fourteen sheets in a row.
    // ------------------------------------------------------------
    function Na__LePubRas__Free(canvasOrPair) {
        const canvas = canvasOrPair && canvasOrPair.canvas ? canvasOrPair.canvas : canvasOrPair;
        if (canvas && canvas.width) { canvas.width = 1; canvas.height = 1; }
    }
    // ------------------------------------------------------------


    // FUNCTION | Resample a Picture to an Exact Size, Halving First
    // ------------------------------------------------------------
    // source may be an image or a canvas. The result is a NEW opaque canvas of
    // exactly width x height, painted over the background colour so no pixel of
    // it carries alpha.
    // ------------------------------------------------------------
    function Na__LePubRas__Resample(source, width, height, background) {
        let current = source;
        let curW = source.naturalWidth || source.width;
        let curH = source.naturalHeight || source.height;
        const temps = [];

        // HALVE WHILE MORE THAN TWICE TOO BIG, so every step averages at most a
        // two-by-two block and no fine line is skipped over.
        while (curW / 2 >= width && curH / 2 >= height) {
            const half = Na__LePubRas__Canvas(Math.max(width, Math.floor(curW / 2)), Math.max(height, Math.floor(curH / 2)), true);
            half.context.fillStyle = background || '#ffffff';
            half.context.fillRect(0, 0, half.canvas.width, half.canvas.height);
            half.context.drawImage(current, 0, 0, half.canvas.width, half.canvas.height);
            temps.push(half);
            current = half.canvas;
            curW = half.canvas.width;
            curH = half.canvas.height;
        }

        const out = Na__LePubRas__Canvas(width, height, true);
        out.context.fillStyle = background || '#ffffff';
        out.context.fillRect(0, 0, width, height);
        out.context.drawImage(current, 0, 0, width, height);
        temps.forEach((one) => Na__LePubRas__Free(one));
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Encode a Canvas to a Blob of a Published Format
    // ------------------------------------------------------------
    function Na__LePubRas__Encode(canvas, format, quality) {
        return new Promise((resolve, reject) => {
            const type = format || 'image/webp';
            canvas.toBlob((blob) => {
                if (!blob) { reject(new Error('The picture could not be encoded as ' + type)); return; }
                // A BROWSER THAT CANNOT WRITE WEBP HANDS BACK A PNG, silently.
                // Published under a .webp name that would be a lie the reader's
                // service worker and the local API's sniffing would both catch
                // later and far less clearly; it is caught here instead.
                if (blob.type && blob.type !== type) {
                    reject(new Error('This browser wrote ' + blob.type + ' when ' + type + ' was asked for; publish from Chrome or Edge.'));
                    return;
                }
                resolve(blob);
            }, type, (typeof quality === 'number') ? quality : undefined);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Hashing
// -----------------------------------------------------------------------------

    // FUNCTION | The First Ten Hex Digits of a Blob's or String's SHA-256
    // ------------------------------------------------------------
    // The same ten digits a stored sheet picture carries in its name, so a
    // published name never means two different files and everything named with
    // one can be cached immutably.
    // ------------------------------------------------------------
    async function Na__LePubRas__Hash(blobOrText) {
        let buffer;
        if (typeof blobOrText === 'string') buffer = new TextEncoder().encode(blobOrText);
        else buffer = await blobOrText.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
        return hex.slice(0, Na__PubSchema__Get().files.hashLength);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Full SHA-256 of a Blob or String, for the Manifest's Record
    // ------------------------------------------------------------
    async function Na__LePubRas__Sha(blobOrText) {
        let buffer;
        if (typeof blobOrText === 'string') buffer = new TextEncoder().encode(blobOrText);
        else buffer = await blobOrText.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Fog: Composited Into the Picture, and a Mask for the Lines
// -----------------------------------------------------------------------------

    // FUNCTION | Composite the Fog Over a Picture, and Build the Linework Mask
    // ------------------------------------------------------------
    // picture : a canvas of the underlay at print size (opaque)
    // fog     : an image of the fog layer at any size (its alpha is the fog)
    // Returns { Picture, Mask } - both opaque canvases of the picture's size.
    // The picture is changed in place; the mask is new.
    //
    // THE MASK IS 1 - FOG ALPHA, AS GREY. White keeps a line at full strength,
    // black hides it, grey fades it - exactly what the fog does to a line on
    // paper. It is written as an opaque greyscale image, so it carries no alpha
    // channel and none of the premultiplied-alpha failure modes the published
    // design exists to avoid.
    // ------------------------------------------------------------
    function Na__LePubRas__ApplyFog(picture, fog) {
        const width  = picture.canvas.width;
        const height = picture.canvas.height;

        // The fog at the picture's size, keeping its alpha
        const fogged = Na__LePubRas__Canvas(width, height, false);
        fogged.context.clearRect(0, 0, width, height);
        fogged.context.drawImage(fog, 0, 0, width, height);

        // 1. Over the picture, exactly as the PDF lays it
        picture.context.drawImage(fogged.canvas, 0, 0);

        // 2. The mask: one minus the fog's alpha, as grey, opaque
        const source = fogged.context.getImageData(0, 0, width, height);
        const mask   = Na__LePubRas__Canvas(width, height, true);
        const out    = mask.context.createImageData(width, height);
        const s = source.data, o = out.data;
        for (let i = 0; i < s.length; i += 4) {
            const keep = 255 - s[i + 3];
            o[i] = keep; o[i + 1] = keep; o[i + 2] = keep; o[i + 3] = 255;
        }
        mask.context.putImageData(out, 0, 0);
        Na__LePubRas__Free(fogged);
        return { Picture : picture, Mask : mask };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Svg to Canvas
// -----------------------------------------------------------------------------

    // FUNCTION | Rasterise an Svg String Onto a New Opaque Canvas
    // ------------------------------------------------------------
    // Used for a site plan viewport, whose "picture" is its fills and hatches
    // drawn from vector data rather than rendered from the model: the same
    // markup the screen paints, rasterised once at print size here so the
    // reader receives one opaque picture like any other viewport's.
    // ------------------------------------------------------------
    async function Na__LePubRas__FromSvg(svgMarkup, width, height, background) {
        const blob = new Blob([ svgMarkup ], { type : 'image/svg+xml' });
        const url  = URL.createObjectURL(blob);
        try {
            const image = await Na__LePubRas__Load(url);
            const out = Na__LePubRas__Canvas(width, height, true);
            out.context.fillStyle = background || '#ffffff';
            out.context.fillRect(0, 0, width, height);
            out.context.drawImage(image, 0, 0, width, height);
            return out;
        } finally {
            URL.revokeObjectURL(url);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Tier Ladder
// -----------------------------------------------------------------------------

    // FUNCTION | Cut Every Published Tier From One Print-Size Picture
    // ------------------------------------------------------------
    // picture : a canvas or image at (about) print resolution
    // frameMm : { WidthMm, HeightMm } - the viewport frame on the paper
    // Returns [ { Tier, PixelW, PixelH, Blob } ] - Print first, then the screen
    // tiers largest to smallest, each cut from the one above it so every
    // halving averages what the one before kept.
    // ------------------------------------------------------------
    async function Na__LePubRas__Ladder(picture, frameMm, options) {
        const o       = options || {};
        const tiers   = Na__PubSchema__Tiers().slice().sort((a, b) => b.pixelsPerMm - a.pixelsPerMm);
        const results = [];
        let   previous = picture;
        const owned    = [];

        for (const tier of tiers) {
            if (tier.id === 'Print' && o.SkipPrint) continue;
            const size = Na__PubSchema__TierPixels(tier.id, frameMm.WidthMm, frameMm.HeightMm);
            if (!size) continue;
            const cut  = Na__LePubRas__Resample(previous, size.PixelW, size.PixelH, o.Background);
            owned.push(cut);
            const blob = await Na__LePubRas__Encode(cut.canvas, tier.format, tier.quality == null ? undefined : tier.quality);
            results.push({ Tier : tier, PixelW : size.PixelW, PixelH : size.PixelH, Blob : blob });
            previous = cut.canvas;                                                // <-- The next tier is cut from this one
        }
        owned.forEach((one) => Na__LePubRas__Free(one));
        return results;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__LePubRas__Canvas,
        Na__LePubRas__Load,
        Na__LePubRas__Free,
        Na__LePubRas__Resample,
        Na__LePubRas__Encode,
        Na__LePubRas__Hash,
        Na__LePubRas__Sha,
        Na__LePubRas__ApplyFog,
        Na__LePubRas__FromSvg,
        Na__LePubRas__Ladder
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
