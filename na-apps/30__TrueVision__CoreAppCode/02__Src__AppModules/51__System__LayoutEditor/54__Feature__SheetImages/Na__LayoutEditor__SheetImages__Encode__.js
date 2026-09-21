// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES - ENCODE
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__Encode__.js
// NAMESPACE  : Na__LeImgEnc
// MODULE     : Layout Editor - Sheet Images - Encode
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn a dropped file into the picture that is stored, name it by its content, and cut print copies for the PDF
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - WHAT IS STORED IS NOT WHAT WAS DROPPED. A render arrives as a 10-20 MB
//   PNG; what goes into the project folder and onto R2 is a WebP of the same
//   picture at the storage quality, with the pixels a print needs at the
//   size the sheet shows it - under a megabyte for a CGI 200 mm wide - cut
//   by the save (Na__LayoutEditor__SheetImages__Publish__). A WebP or JPEG
//   already inside the limits and wanted at its own size is stored byte for
//   byte, so a photograph is never compressed twice.
// - THE NAME IS THE CONTENT. The stored file is named after the dropped
//   file's name with the first ten hex digits of the stored bytes' SHA-256 on
//   the end ("RB03_T01_V10__FrontFascade__SouthElevation__28-Aug-2026__3f9a2c1d0b.webp"),
//   so the same picture dropped twice is stored once, two pictures can never
//   share a name, and a copy found in any folder is known to be the right one.
// - THE DROPPED FILE IS READ INTO MEMORY FIRST and handed back with the stored
//   picture as its source: the save cuts the picture it keeps from that
//   original at the size the sheet prints it (Recut), so the picture is
//   encoded once from the original, never re-encoded from a re-encode - and
//   the render may be moved or deleted on disk the moment it has dropped.
// - A PDF COPY is the kept part alone, resampled to the print resolution at
//   the size it prints and never above the pixels it has: JPEG, or PNG when
//   the picture has transparency (jsPDF drops the alpha of raw RGBA).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - Prepare reads the dropped file into memory and returns it as the source
//   the save cuts from; Recut makes the stored picture at any size from that
//   source, through the same encoder as the drop (Store), so a cut at the
//   drop's own size is the drop's own file, byte for byte.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Setup and Geometry
    // ------------------------------------------------------------
    import { Na__LeImgCfg__Storage, Na__LeImgCfg__Pdf } from './Na__LayoutEditor__SheetImages__Setup__.js';
    import { Na__LeImgGeo__FileName, Na__LeImgGeo__PdfPixels, Na__LeImgGeo__CropOf } from './Na__LayoutEditor__SheetImages__Geometry__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Types by Extension, and the Alpha Probe's Size
    // ------------------------------------------------------------
    const Na__LeImgEnc__TYPES = { png : 'image/png', jpg : 'image/jpeg', jpeg : 'image/jpeg', webp : 'image/webp', gif : 'image/gif', bmp : 'image/bmp', avif : 'image/avif' };
    const Na__LeImgEnc__EXTENSIONS = { 'image/webp' : 'webp', 'image/jpeg' : 'jpg', 'image/png' : 'png' };
    const Na__LeImgEnc__ALPHA_PROBE_PX = 512;                                   // <-- Transparency anywhere shows at this size too
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A File's Picture Type, From the Browser or From Its Name
    // ------------------------------------------------------------
    function Na__LeImgEnc__TypeOf(file) {
        const type = String((file && file.type) || '').toLowerCase();
        if (type.indexOf('image/') === 0) return type === 'image/jpg' ? 'image/jpeg' : type;
        const match = /\.([A-Za-z0-9]{1,5})$/.exec(String((file && file.name) || ''));
        return match ? (Na__LeImgEnc__TYPES[match[1].toLowerCase()] || '') : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Decode a Picture: { source, width, height, close }
    // ------------------------------------------------------------
    // createImageBitmap first - it decodes off the main thread and honours a
    // photograph's EXIF turn - and an <img> when the browser cannot.
    // ------------------------------------------------------------
    async function Na__LeImgEnc__Decode(blob) {
        if (typeof createImageBitmap === 'function') {
            try {
                const bitmap = await createImageBitmap(blob);
                return { source : bitmap, width : bitmap.width, height : bitmap.height, close : () => { try { bitmap.close(); } catch (e) { /* already gone */ } } };
            } catch (error) { /* fall through to an <img> */ }
        }
        const url = URL.createObjectURL(blob);
        try {
            const image = new Image();
            image.decoding = 'async';
            image.src = url;
            await image.decode();
            return { source : image, width : image.naturalWidth, height : image.naturalHeight, close : () => {} };
        } finally {
            URL.revokeObjectURL(url);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Canvas of a Size, and Its Encoder
    // ------------------------------------------------------------
    function Na__LeImgEnc__Canvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width  = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        return canvas;
    }
    function Na__LeImgEnc__ToBlob(canvas, type, quality) {
        return new Promise((resolve) => {
            try { canvas.toBlob((blob) => resolve(blob || null), type, quality); }
            catch (error) { resolve(null); }
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does a Picture Have Any Transparency
    // ------------------------------------------------------------
    // Asked of a small copy: a transparent region of any useful size still
    // shows there, and scanning a 4K picture's sixteen million bytes to find
    // out would hold the drop up for no gain. A JPEG never has any.
    // ------------------------------------------------------------
    function Na__LeImgEnc__HasAlpha(decoded, type) {
        if (type === 'image/jpeg') return false;
        const scale  = Math.min(1, Na__LeImgEnc__ALPHA_PROBE_PX / Math.max(decoded.width, decoded.height));
        const canvas = Na__LeImgEnc__Canvas(decoded.width * scale, decoded.height * scale);
        const ctx    = canvas.getContext('2d', { willReadFrequently : true });
        if (!ctx) return false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The First Hex Digits of a Blob's SHA-256
    // ------------------------------------------------------------
    // SubtleCrypto needs a secure context, which localhost is. Anywhere it is
    // missing a 64-bit FNV-1a stands in: the name is still stable for the same
    // bytes, which is all a name has to be; the local server checks the SHA
    // and refuses a mismatch, so such a name is only ever used off localhost.
    // ------------------------------------------------------------
    async function Na__LeImgEnc__Hash(blob) {
        const buffer = await blob.arrayBuffer();
        if (window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
            try {
                const digest = await window.crypto.subtle.digest('SHA-256', buffer);
                return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
            } catch (error) { /* fall through */ }
        }
        let h1 = 0x811c9dc5 >>> 0, h2 = 0xcbf29ce4 >>> 0;
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.length; i++) {
            h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0;
            h2 = Math.imul(h2 ^ bytes[(bytes.length - 1) - i], 0x01000193) >>> 0;
        }
        return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Picture Stored at One Size: { blob, width, height, reencoded }
    // ------------------------------------------------------------
    // decoded is the source already decoded. At the source's own size a WebP
    // or JPEG inside the limits is kept byte for byte - a photograph is never
    // compressed twice - and everything else is drawn at the size asked and
    // written at the storage quality.
    // ------------------------------------------------------------
    async function Na__LeImgEnc__Store(decoded, source, width, height, setup) {
        const keep = width === decoded.width && height === decoded.height &&
            setup.passThroughTypes.indexOf(source.type) !== -1 &&
            Math.max(width, height) <= setup.maxEdgePx && source.blob.size <= setup.passThroughMaxBytes;
        if (keep) return { blob : source.blob, width : width, height : height, reencoded : false };
        const canvas = Na__LeImgEnc__Canvas(width, height);
        const ctx    = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
        let blob = await Na__LeImgEnc__ToBlob(canvas, setup.format, setup.quality);
        // A BROWSER THAT CANNOT WRITE WEBP hands back a PNG instead. That is
        // kept for a picture with transparency; anything else goes to JPEG,
        // which every browser writes, rather than to a lossless file five
        // times the size.
        if (!blob || Na__LeImgEnc__EXTENSIONS[blob.type] === undefined || (blob.type === 'image/png' && setup.format !== 'image/png' && !source.alpha)) {
            if (!source.alpha) {
                const flat = Na__LeImgEnc__Canvas(canvas.width, canvas.height);
                const fctx = flat.getContext('2d');
                fctx.fillStyle = '#ffffff';
                fctx.fillRect(0, 0, flat.width, flat.height);
                fctx.drawImage(canvas, 0, 0);
                blob = await Na__LeImgEnc__ToBlob(flat, 'image/jpeg', setup.quality);
            } else if (!blob || blob.type !== 'image/png') {
                blob = await Na__LeImgEnc__ToBlob(canvas, 'image/png');
            }
        }
        if (!blob) throw new Error('the picture could not be encoded');
        return { blob : blob, width : canvas.width, height : canvas.height, reencoded : true };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Can This File Be Placed on a Sheet at All
    // ------------------------------------------------------------
    // Resolves to null when it can, or { reason: 'type' | 'size', limitMb }.
    // ------------------------------------------------------------
    function Na__LeImgEnc__Refusal(file) {
        const setup = Na__LeImgCfg__Storage();
        const type  = Na__LeImgEnc__TypeOf(file);
        if (!type || setup.acceptTypes.indexOf(type) === -1) return { reason : 'type' };
        if (file.size > setup.maxInputBytes) return { reason : 'size', limitMb : Math.round(setup.maxInputBytes / 1048576) };
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Picture to Show for a Dropped File, and the Original to Cut the Stored One From
    // ------------------------------------------------------------
    // Resolves to { blob, fileName, type, pixelW, pixelH, alpha, name,
    // reencoded, source }, or rejects with a message fit for the toast. The
    // picture is the drop's own size (the original, no larger than the
    // storage edge); source is { blob, name, type, alpha, pixelW, pixelH },
    // the dropped file in memory, which the save cuts the stored picture
    // from once the sheet says what size it prints at.
    // ------------------------------------------------------------
    async function Na__LeImgEnc__Prepare(file) {
        const setup    = Na__LeImgCfg__Storage();
        const type     = Na__LeImgEnc__TypeOf(file);
        const original = new Blob([ await file.arrayBuffer() ], { type : type || file.type || '' });   // <-- Read once; the file on disk may go the moment it has dropped
        const decoded  = await Na__LeImgEnc__Decode(original);
        try {
            if (!(decoded.width > 0) || !(decoded.height > 0)) throw new Error('empty picture');
            const alpha  = Na__LeImgEnc__HasAlpha(decoded, type);
            const source = { blob : original, name : String(file.name || ''), type : type, alpha : alpha, pixelW : decoded.width, pixelH : decoded.height };
            const scale  = Math.min(1, setup.maxEdgePx / Math.max(decoded.width, decoded.height));
            const stored = await Na__LeImgEnc__Store(decoded, source, Math.max(1, Math.round(decoded.width * scale)), Math.max(1, Math.round(decoded.height * scale)), setup);
            const hash   = await Na__LeImgEnc__Hash(stored.blob);
            return {
                blob      : stored.blob,
                fileName  : Na__LeImgGeo__FileName(source.name, hash, Na__LeImgEnc__EXTENSIONS[stored.blob.type] || 'webp'),
                type      : stored.blob.type,
                pixelW    : stored.width,
                pixelH    : stored.height,
                alpha     : alpha,
                name      : source.name,
                reencoded : stored.reencoded,
                source    : source
            };
        } finally {
            decoded.close();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | The Stored Picture Cut From Its Original at a Size
    // ------------------------------------------------------------
    // source is what Prepare returned as source. Resolves to { blob,
    // fileName, type, pixelW, pixelH, reencoded }, or null with no source.
    // The same encoder as the drop, so the drop's own size gives back the
    // drop's own file and name.
    // ------------------------------------------------------------
    async function Na__LeImgEnc__Recut(source, width, height) {
        if (!source || !(source.blob instanceof Blob)) return null;
        const setup   = Na__LeImgCfg__Storage();
        const decoded = await Na__LeImgEnc__Decode(source.blob);
        try {
            const stored = await Na__LeImgEnc__Store(decoded, source, Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), setup);
            const hash   = await Na__LeImgEnc__Hash(stored.blob);
            return {
                blob      : stored.blob,
                fileName  : Na__LeImgGeo__FileName(source.name, hash, Na__LeImgEnc__EXTENSIONS[stored.blob.type] || 'webp'),
                type      : stored.blob.type,
                pixelW    : stored.width,
                pixelH    : stored.height,
                reencoded : stored.reencoded
            };
        } finally {
            decoded.close();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | A Picture's Soft Shadow as a Transparent PNG, for the PDF
    // ------------------------------------------------------------
    // shadow is Na__LeImgDraw__ShadowOf's description. The image covers the
    // picture's box and MarginMm round it. The box is drawn off the canvas
    // and only its shadow is offset back into view - the canvas's shadow blur
    // is the same Gaussian as the screen's feDropShadow (its standard
    // deviation is half of shadowBlur) - then the middle, which the picture
    // covers, is cleared, which also keeps the PNG small.
    // ------------------------------------------------------------
    function Na__LeImgEnc__ShadowPng(widthMm, heightMm, shadow, pxPerMm) {
        if (!shadow || !(widthMm > 0) || !(heightMm > 0)) return null;
        const r      = Math.max(2, pxPerMm || 5);
        const m      = shadow.MarginMm;
        const canvas = Na__LeImgEnc__Canvas((widthMm + (2 * m)) * r, (heightMm + (2 * m)) * r);
        const ctx    = canvas.getContext('2d');
        if (!ctx) return null;
        const hex  = String(shadow.Colour || '#000000').replace('#', '');
        const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
        const rgb  = /^[0-9a-fA-F]{6}$/.test(full) ? [ 0, 2, 4 ].map((i) => parseInt(full.substring(i, i + 2), 16)) : [ 0, 0, 0 ];
        const far  = canvas.width + 1000;                                       // <-- The box itself lands off the canvas
        ctx.shadowColor   = 'rgba(' + rgb.join(',') + ',' + shadow.Opacity + ')';
        ctx.shadowBlur    = 2 * shadow.BlurMm * r;
        ctx.shadowOffsetX = (shadow.OffsetXMm * r) + far;
        ctx.shadowOffsetY = shadow.OffsetYMm * r;
        ctx.fillStyle     = '#000000';
        ctx.fillRect((m * r) - far, m * r, widthMm * r, heightMm * r);
        ctx.shadowColor   = 'transparent';
        ctx.clearRect((m * r) + 1, (m * r) + 1, (widthMm * r) - 2, (heightMm * r) - 2);
        return canvas.toDataURL('image/png');
    }
    // ------------------------------------------------------------


    // FUNCTION | A Print Copy of the Kept Part, for the PDF
    // ------------------------------------------------------------
    // rectMm is the box it prints at. Resolves to { dataUrl, format } or null.
    // ------------------------------------------------------------
    async function Na__LeImgEnc__PdfCopy(blob, crop, rectMm, alpha) {
        if (!(blob instanceof Blob)) return null;
        const setup   = Na__LeImgCfg__Pdf();
        const decoded = await Na__LeImgEnc__Decode(blob);
        try {
            const c    = Na__LeImgGeo__CropOf(crop);
            const size = Na__LeImgGeo__PdfPixels(rectMm, decoded.width, decoded.height, crop, setup.maxDpi);
            const canvas = Na__LeImgEnc__Canvas(size.w, size.h);
            const ctx    = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            if (!alpha) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }   // <-- JPEG has no alpha: paper white under the picture
            ctx.drawImage(decoded.source,
                c.L * decoded.width, c.T * decoded.height, (c.R - c.L) * decoded.width, (c.B - c.T) * decoded.height,
                0, 0, canvas.width, canvas.height);
            return alpha
                ? { dataUrl : canvas.toDataURL('image/png'), format : 'PNG' }
                : { dataUrl : canvas.toDataURL('image/jpeg', setup.jpegQuality), format : 'JPEG' };
        } finally {
            decoded.close();
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images Encode API
    // ------------------------------------------------------------
    export {
        Na__LeImgEnc__TypeOf,
        Na__LeImgEnc__Refusal,
        Na__LeImgEnc__Prepare,
        Na__LeImgEnc__Recut,
        Na__LeImgEnc__ShadowPng,
        Na__LeImgEnc__PdfCopy
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
