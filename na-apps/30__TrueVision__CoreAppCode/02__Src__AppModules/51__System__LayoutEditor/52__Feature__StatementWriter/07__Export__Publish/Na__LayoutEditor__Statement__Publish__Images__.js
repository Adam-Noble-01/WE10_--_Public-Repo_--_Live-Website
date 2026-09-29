// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT PUBLISH - PICTURES
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Publish__Images__.js
// NAMESPACE  : Na__LeStmtPub
// MODULE     : Layout Editor - Statement Writer - Publishing the Pictures
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Send the pictures a statement actually uses to the CDN, at a size a reader can actually use
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - ONLY THE PICTURES THE STATEMENT LINKS TO GO UP. The RB05 statement folder
//   holds 713 MB of photography; the statement itself uses sixteen pictures.
//   Publishing the folder would be publishing the contact sheet, the
//   photogrammetry dataset and every rejected frame along with the document.
//   So the markdown is read, the links are resolved, and those files and no
//   others are uploaded.
// - THEY GO UP SMALLER THAN THEY ARE, AND HERE IS THE ARITHMETIC. A statement
//   is A4. Its text block is 188 mm. The PDF rasterises the page at about
//   192 dpi, so the widest a picture is ever actually SEEN at is around 1450
//   pixels - and the originals are 6144 across and 13 MB each. Resizing to a
//   2000 pixel long edge keeps a comfortable margin over what any reader or
//   printer can resolve, takes those sixteen pictures from roughly 75 MB to a
//   few megabytes, and makes a publish take seconds rather than minutes.
//   THE ORIGINAL ON DISK IS NEVER TOUCHED. Only the copy that is published is
//   resized, and it is regenerated from the original every time.
// - WEBP, BECAUSE A CGI IS MOSTLY SKY. The soft gradients these renders are
//   full of are exactly what JPEG bands and WebP does not, at about two
//   thirds the weight. A picture already small and already well compressed is
//   passed through untouched rather than being re-encoded a second time and
//   losing a little more each publish.
// - THE FOLDER STRUCTURE IS MIRRORED, NOT FLATTENED. ProjectVision's older
//   statement builder copies every picture into one folder; this keeps
//   02__Site__Location and 20__Proposed__3dExterior as they are, because that
//   is how the photography is organised and a flattened folder of four hundred
//   files is not something anyone can work in afterwards.
// - EVERY PICTURE GOES INTO R2 AT THE ADDRESS THE STATEMENT LINKS TO, under its
//   own name (v2.172.0). R2 is where a published statement is read from, so
//   R2 on its own must be right: the markdown on R2 says
//   ./02__DocImages/02__Site__Location/Location__Near__.png, and that is where
//   its picture now is - whatever reads it, whichever release of the app is
//   reading, with no mapping to consult. A resized copy is still WebP (the
//   weight is the point) and is stored under the original's name with its
//   true content type, image/webp, which is what a browser goes by. Until
//   v2.172.0 a resized copy took the .webp suffix and a link resolved by file
//   name went up where the file really was - so the web viewer, asking R2 for
//   exactly what the markdown names, got a 404 for 24 of RB05's 35 pictures.
//   Only when R2 refuses the linked address (a link that climbs out of the
//   folder with ..) does the picture go up where the file really is.
//
// INTEGRATION:
// - Used by Na__LayoutEditor__Statement__Publish__, which then rewrites the
//   HTML's links to the URLs this hands back.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 20-Sep-2026)
// - Back-port     : offer to ValeVision3D with the statement tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.2.0
// - A PICTURE IS PUBLISHED WHERE THE STATEMENT SAYS IT IS (TrueVision3D
//   v2.172.0): at its link's own address in R2, under its own name, never
//   renamed to .webp and never moved to where a stale link's file was found.
//   R2 is the primary copy and must be readable on its own; the web viewer
//   asks R2 for exactly what the markdown names.
// - A picture's content type is taken from its file name when the local
//   server gives none or a generic one (.webp came as octet-stream).
//
// 29-Sep-2026 - Version 1.1.0
// - Each picture sent reports its ORIGINAL's size as well as its own
//   (sourceWidth, sourceHeight), so the published page can keep a figure the
//   size it is in the app when the copy sent is smaller (TrueVision3D
//   v2.170.0). A copy that could not be re-encoded now reports the size of
//   the original it falls back to, not the size it was meant to be.
//
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and the Cloudflare Statement Routes
    // ------------------------------------------------------------
    import { Na__LeCfg__GetStatementSetup } from '../../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__CfApi__StatementFileLocation,
        Na__CfApi__WriteStatementFile
    } from '../../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading and Resizing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fetch One Picture as It Is on Disk
    // ------------------------------------------------------------
    async function Na__LeStmtPub__Fetch(url) {
        try {
            const response = await fetch(url, { cache : 'no-store' });
            if (!response.ok) return { ok : false, error : 'HTTP ' + response.status };
            return { ok : true, blob : await response.blob() };
        } catch (error) {
            return { ok : false, error : (error && error.message) || 'unreachable' };
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | A Picture at Publishing Size
    // ------------------------------------------------------------
    // Resolves to { blob, type, width, height, sourceWidth, sourceHeight,
    // resized }: width and height are the blob's own, sourceWidth and
    // sourceHeight the original's - which the page needs, because a figure is
    // sized from its picture's pixels and must keep its size when the copy
    // sent is smaller. A picture already within the size AND the weight is
    // handed back untouched: re-encoding it would cost a little quality for
    // nothing.
    // ------------------------------------------------------------
    async function Na__LeStmtPub__Resize(blob, setup) {
        const maxEdge = setup.imageMaxEdgePx;

        // AN SVG HAS NO PIXELS TO COUNT and nothing to gain from a canvas
        if (/svg/i.test(blob.type || '')) return { blob : blob, type : blob.type, width : 0, height : 0, sourceWidth : 0, sourceHeight : 0, resized : false };

        let bitmap = null;
        try {
            bitmap = await createImageBitmap(blob);
        } catch (error) {
            return { blob : blob, type : blob.type, width : 0, height : 0, sourceWidth : 0, sourceHeight : 0, resized : false, error : 'could not be decoded' };
        }

        // THE BITMAP'S OWN SIZE IS READ ONCE AND KEPT. Closing a bitmap sets
        // its width and height to zero, so anything read from it afterwards is
        // a pair of noughts - which is what the pass-through path reported
        // into the index the first time this ran.
        const sourceWidth  = bitmap.width;
        const sourceHeight = bitmap.height;
        const longest      = Math.max(sourceWidth, sourceHeight);

        if (longest <= maxEdge && blob.size <= setup.imagePassThrough) {
            bitmap.close();
            return { blob : blob, type : blob.type, width : sourceWidth, height : sourceHeight, sourceWidth : sourceWidth, sourceHeight : sourceHeight, resized : false };
        }

        const scale  = Math.min(1, maxEdge / longest);
        const width  = Math.max(1, Math.round(sourceWidth  * scale));
        const height = Math.max(1, Math.round(sourceHeight * scale));

        const canvas  = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        const made = await new Promise((resolve) => canvas.toBlob(resolve, setup.imageFormat, setup.imageQuality));
        if (!made) return { blob : blob, type : blob.type, width : sourceWidth, height : sourceHeight, sourceWidth : sourceWidth, sourceHeight : sourceHeight, resized : false, error : 'could not be re-encoded' };   // <-- The original goes, so its own size

        // A "SMALLER" COPY THAT IS BIGGER is not an improvement. It happens
        // with flat graphics - a plan exported as PNG - and with a photograph
        // already compressed about as far as it will go, where the original
        // beats what a second pass can do. Only when nothing was scaled away:
        // a picture that came down from 6144 pixels is worth keeping even if
        // its file happens not to have shrunk.
        if (made.size >= blob.size && longest <= maxEdge) {
            return { blob : blob, type : blob.type, width : sourceWidth, height : sourceHeight, sourceWidth : sourceWidth, sourceHeight : sourceHeight, resized : false };
        }

        return { blob : made, type : setup.imageFormat, width : width, height : height, sourceWidth : sourceWidth, sourceHeight : sourceHeight, resized : true };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Publishing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Picture's Content Type, Even When the Server Did Not Say
    // ------------------------------------------------------------
    // R2 serves a file with the type it was stored with. The local server on
    // this machine answers a .webp as application/octet-stream (Python's type
    // table here has no .webp), so three of RB05's pictures went up that way on
    // 29-Sep-2026. A picture's own type wins; a missing or generic one is taken
    // from the file name.
    // ------------------------------------------------------------
    const Na__LeStmtPub__TYPES = Object.freeze({
        webp : 'image/webp', png : 'image/png', jpg : 'image/jpeg', jpeg : 'image/jpeg',
        gif  : 'image/gif',  svg : 'image/svg+xml', bmp : 'image/bmp', tif : 'image/tiff', tiff : 'image/tiff'
    });
    function Na__LeStmtPub__TypeOf(type, path) {
        if (type && /^image\//i.test(type)) return type;
        const extension = (/\.([A-Za-z0-9]+)$/.exec(String(path || '')) || [])[1];
        return (extension && Na__LeStmtPub__TYPES[extension.toLowerCase()]) || type || 'application/octet-stream';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Picture Goes in R2
    // ------------------------------------------------------------
    // The address its link names (picture.target, the path a reader off this
    // machine asks for - Na__LeStmtImg__Used), under its own name whatever it
    // is re-encoded as. Only a link R2 will not take (one that climbs out of
    // the folder) goes up where the file was found instead.
    // ------------------------------------------------------------
    function Na__LeStmtPub__Target(picture) {
        const linked = picture.target || picture.path;
        return Na__CfApi__StatementFileLocation(linked) ? linked : picture.path;
    }
    // ------------------------------------------------------------


    // FUNCTION | Send Every Picture a Statement Uses to the CDN
    // ------------------------------------------------------------
    // used      what Na__LeStmtImg__Used found: [{ src, path, target, matched }]
    // onProgress(message, fraction)
    //
    // Resolves to { ok, links, failed, bytes } where links maps the link as
    // the markdown writes it to the CDN URL it became - which is the address
    // the link itself names in R2 (Target). A picture that could not be found
    // or sent is reported and the rest still go: a statement with fifteen of
    // its sixteen pictures is worth more than no statement.
    // ------------------------------------------------------------
    async function Na__LeStmtPub__Send(used, onProgress) {
        const setup = Na__LeCfg__GetStatementSetup();
        const say   = (typeof onProgress === 'function') ? onProgress : () => {};
        const links = {};
        const failed = [];
        let   bytes  = 0;
        let   done   = 0;

        for (const picture of (used || [])) {
            done += 1;
            const share = done / Math.max(1, used.length);

            if (!picture.path) {
                failed.push({ src : picture.src, why : 'no file of that name is in the statement folder' });
                continue;
            }

            const location = Na__CfApi__StatementFileLocation(picture.path);
            if (!location) {
                failed.push({ src : picture.src, why : 'that path cannot be published' });
                continue;
            }

            say('Reading ' + picture.path.split('/').pop() + '…', share * 0.9);
            const read = await Na__LeStmtPub__Fetch(location.repoUrl);
            if (!read.ok) {
                failed.push({ src : picture.src, why : 'could not be read (' + (read.error || 'unknown') + ')' });
                continue;
            }

            const sized  = await Na__LeStmtPub__Resize(read.blob, setup);
            const target = Na__LeStmtPub__Target(picture);                    // <-- Where the statement says it is, under its own name

            say('Sending ' + target.split('/').pop() + '…', share * 0.95);
            const wrote = await Na__CfApi__WriteStatementFile(target, sized.blob, Na__LeStmtPub__TypeOf(sized.type, picture.path));
            if (!wrote || !wrote.ok) {
                failed.push({ src : picture.src, why : 'the upload failed (' + ((wrote && wrote.error) || 'unknown') + ')' });
                continue;
            }

            bytes += sized.blob.size;
            links[picture.src] = {
                url          : wrote.publicUrl,
                path         : target,
                bytes        : sized.blob.size,
                width        : sized.width,
                height       : sized.height,
                sourceWidth  : sized.sourceWidth,
                sourceHeight : sized.sourceHeight,
                resized      : sized.resized
            };
        }

        say('Pictures done.', 1);
        return { ok : failed.length === 0, links : links, failed : failed, bytes : bytes };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Picture Publishing API
    // ------------------------------------------------------------
    export {
        Na__LeStmtPub__Send,
        Na__LeStmtPub__Resize
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
