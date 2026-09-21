// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES - GEOMETRY
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__Geometry__.js
// NAMESPACE  : Na__LeImgGeo
// MODULE     : Layout Editor - Sheet Images - Geometry
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The arithmetic of a picture on the paper: its box, its crop, its corners, its print resolution and its file names
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - A picture's four points are the corners of the part of it that shows, in
//   paper millimetres, clockwise from the top left. Everything here reads or
//   writes that box, so the record, the painter, the grips, the crop and the
//   PDF agree on it without asking each other.
// - A PICTURE IS NEVER STRETCHED. Its box always has the proportions of the
//   kept part of the stored file; scaling moves one corner along the box's
//   diagonal, and the only way to change the proportions is to crop, which
//   takes paper away and never scales what is left.
// - A LEAF: it imports nothing, so the record normaliser can hold a picture
//   to its proportions without reaching anything else in the feature.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - StoreSize: the pixels a picture is stored at - what a print at the given
//   dpi needs at the largest size any drawing shows it, never above the
//   dropped original or the storage edge, in the original's exact proportions
//   wherever they allow it. NeedsRecut: whether the stored file is far enough
//   from that to be worth cutting again.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Tolerances, Corner Order and the Stored File Name
    // ------------------------------------------------------------
    const Na__LeImgGeo__EPSILON      = 1e-9;
    const Na__LeImgGeo__MM_PER_INCH  = 25.4;
    const Na__LeImgGeo__MIN_STORE_PX = 256;                                       // <-- The long edge no picture is stored below, however small it is drawn
    const Na__LeImgGeo__EXACT_STEP   = 0.05;                                      // <-- Exact proportions when their smallest whole step is under this share of the width
    const Na__LeImgGeo__HASH_DIGITS  = 10;                                        // <-- Hex digits of the SHA-256 a stored file name ends in
    const Na__LeImgGeo__MANAGED_NAME = /^[A-Za-z0-9][A-Za-z0-9_\-.]*__[0-9a-f]{10}\.(webp|jpg|png)$/;   // <-- A file this feature stored: the save only ever archives these
    const Na__LeImgGeo__FOLDER_CHARS = /[^A-Za-z0-9_\-.]+/g;
    const Na__LeImgGeo__SLUG_MAX     = 72;
    const Na__LeImgGeo__FOLDER_MAX   = 120;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Box
// -----------------------------------------------------------------------------

    // FUNCTION | The Box a Run of Points Spans: { x0, y0, x1, y1, w, h }
    // ------------------------------------------------------------
    function Na__LeImgGeo__Rect(points) {
        const list = Array.isArray(points) ? points.filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) : [];
        if (!list.length) return { x0 : 0, y0 : 0, x1 : 0, y1 : 0, w : 0, h : 0 };
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        list.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
        return { x0 : x0, y0 : y0, x1 : x1, y1 : y1, w : x1 - x0, h : y1 - y0 };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Four Corners of a Box, Clockwise From the Top Left
    // ------------------------------------------------------------
    function Na__LeImgGeo__RectPoints(x0, y0, w, h) {
        return [ [ x0, y0 ], [ x0 + w, y0 ], [ x0 + w, y0 + h ], [ x0, y0 + h ] ];
    }
    // ------------------------------------------------------------


    // FUNCTION | One Corner of a Box (0 top left, 1 top right, 2 bottom right, 3 bottom left)
    // ------------------------------------------------------------
    function Na__LeImgGeo__Corner(rect, index) {
        const i = ((Math.round(index) % 4) + 4) % 4;
        return {
            x : (i === 1 || i === 2) ? rect.x0 + rect.w : rect.x0,
            y : (i === 2 || i === 3) ? rect.y0 + rect.h : rect.y0
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Crop
// -----------------------------------------------------------------------------

    // FUNCTION | A Crop Held Inside the Picture, or null for the Whole Picture
    // ------------------------------------------------------------
    // { L, T, R, B } are fractions of the stored picture: its left, top,
    // right and bottom edges are 0, 0, 1, 1. Each span keeps at least
    // minSpan, taken from whichever side has room. The whole picture is null,
    // so a picture that was never cropped stores no crop at all.
    // ------------------------------------------------------------
    function Na__LeImgGeo__NormaliseCrop(crop, minSpan) {
        if (!crop || typeof crop !== 'object') return null;
        const span = Math.max(0.001, Math.min(0.5, Number.isFinite(minSpan) ? minSpan : 0.04));
        const clamp = (value, fallback) => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : fallback));
        let L = clamp(crop.L, 0), T = clamp(crop.T, 0), R = clamp(crop.R, 1), B = clamp(crop.B, 1);
        if (R < L) { const s = L; L = R; R = s; }
        if (B < T) { const s = T; T = B; B = s; }
        if (R - L < span) { const mid = Math.max(span / 2, Math.min(1 - (span / 2), (L + R) / 2)); L = mid - (span / 2); R = mid + (span / 2); }
        if (B - T < span) { const mid = Math.max(span / 2, Math.min(1 - (span / 2), (T + B) / 2)); T = mid - (span / 2); B = mid + (span / 2); }
        const whole = L <= 1e-6 && T <= 1e-6 && R >= 1 - 1e-6 && B >= 1 - 1e-6;
        return whole ? null : { L : L, T : T, R : R, B : B };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Crop as Four Numbers, the Whole Picture When There Is None
    // ------------------------------------------------------------
    function Na__LeImgGeo__CropOf(crop) {
        return (crop && typeof crop === 'object') ? { L : crop.L, T : crop.T, R : crop.R, B : crop.B } : { L : 0, T : 0, R : 1, B : 1 };
    }
    // ------------------------------------------------------------


    // FUNCTION | Width Over Height of the Kept Part, in Pixels
    // ------------------------------------------------------------
    function Na__LeImgGeo__KeptAspect(pixelW, pixelH, crop) {
        const c  = Na__LeImgGeo__CropOf(crop);
        const pw = Math.max(1, Number(pixelW) || 1), ph = Math.max(1, Number(pixelH) || 1);
        return Math.max(Na__LeImgGeo__EPSILON, ((c.R - c.L) * pw) / Math.max(Na__LeImgGeo__EPSILON, (c.B - c.T) * ph));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Kept Part's Size in Pixels
    // ------------------------------------------------------------
    function Na__LeImgGeo__KeptPixels(pixelW, pixelH, crop) {
        const c = Na__LeImgGeo__CropOf(crop);
        return { w : Math.max(1, (c.R - c.L) * pixelW), h : Math.max(1, (c.B - c.T) * pixelH) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the WHOLE Picture Would Sit, Given Where Its Kept Part Sits
    // ------------------------------------------------------------
    // The crop screen shows the rest of the picture dimmed round the kept
    // part, at the same scale, so it needs the uncropped picture's box.
    // ------------------------------------------------------------
    function Na__LeImgGeo__WholeRect(rect, crop) {
        const c  = Na__LeImgGeo__CropOf(crop);
        const sx = rect.w / Math.max(Na__LeImgGeo__EPSILON, c.R - c.L);
        const sy = rect.h / Math.max(Na__LeImgGeo__EPSILON, c.B - c.T);
        const x0 = rect.x0 - (c.L * sx), y0 = rect.y0 - (c.T * sy);
        return { x0 : x0, y0 : y0, x1 : x0 + sx, y1 : y0 + sy, w : sx, h : sy };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Box a New Crop Leaves, the Picture Not Moving on the Paper
    // ------------------------------------------------------------
    // Cropping takes paper away and never scales what is left: the whole
    // picture's box is worked out from the old crop, and the new kept part
    // is cut out of that same box.
    // ------------------------------------------------------------
    function Na__LeImgGeo__ApplyCrop(rect, oldCrop, newCrop) {
        const whole = Na__LeImgGeo__WholeRect(rect, oldCrop);
        const c     = Na__LeImgGeo__CropOf(newCrop);
        const x0    = whole.x0 + (c.L * whole.w);
        const y0    = whole.y0 + (c.T * whole.h);
        const w     = (c.R - c.L) * whole.w;
        const h     = (c.B - c.T) * whole.h;
        return { x0 : x0, y0 : y0, x1 : x0 + w, y1 : y0 + h, w : w, h : h };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Proportions, Placement and Scaling
// -----------------------------------------------------------------------------

    // FUNCTION | A Box Held to the Kept Part's Proportions (top left and width kept)
    // ------------------------------------------------------------
    // The record normaliser's guard. A picture reaches its points through the
    // corner grips and the crop, which both keep the proportions exactly; this
    // is what holds them if anything else ever writes the points - a hand
    // edit of the project file, a tool that does not know what a picture is.
    // Returns the same array when nothing needed changing, so a normalise of
    // a sound picture writes nothing.
    // ------------------------------------------------------------
    function Na__LeImgGeo__Enforce(points, pixelW, pixelH, crop, minSizeMm) {
        const rect   = Na__LeImgGeo__Rect(points);
        const aspect = Na__LeImgGeo__KeptAspect(pixelW, pixelH, crop);
        const min    = Math.max(0.5, Number(minSizeMm) || 1);
        let w = rect.w, h = rect.h;
        if (!(w > 0) && !(h > 0)) { w = min * Math.max(1, aspect); h = w / aspect; }
        else if (!(w > 0)) w = h * aspect;
        const wantH = w / aspect;
        const exact = Array.isArray(points) && points.length === 4 &&
            Math.abs(h - wantH) <= 1e-6 * Math.max(1, wantH) &&
            Na__LeImgGeo__RectPoints(rect.x0, rect.y0, w, h).every((p, i) => Math.abs(p[0] - points[i][0]) < 1e-9 && Math.abs(p[1] - points[i][1]) < 1e-9);
        if (exact) return points;
        return Na__LeImgGeo__RectPoints(rect.x0, rect.y0, w, wantH);
    }
    // ------------------------------------------------------------


    // FUNCTION | A New Picture's Box: the Right Proportions, Centred, Inside a Room
    // ------------------------------------------------------------
    // centre { x, y } paper mm; maxW and maxH the room it may take.
    // ------------------------------------------------------------
    function Na__LeImgGeo__FitPlacement(centre, pixelW, pixelH, maxW, maxH) {
        const aspect = Na__LeImgGeo__KeptAspect(pixelW, pixelH, null);
        let w = Math.max(1, maxW);
        let h = w / aspect;
        if (h > maxH && maxH > 0) { h = maxH; w = h * aspect; }
        return { x0 : centre.x - (w / 2), y0 : centre.y - (h / 2), x1 : centre.x + (w / 2), y1 : centre.y + (h / 2), w : w, h : h };
    }
    // ------------------------------------------------------------


    // FUNCTION | Scale a Picture From One Corner, the Opposite Corner Fixed
    // ------------------------------------------------------------
    // start is the box when the drag began, corner the grip held (0-3), aim
    // the pointer. The held corner slides along the box's diagonal to the
    // point nearest the pointer, so the grip stays under the hand and the
    // proportions cannot change. A pointer that crosses the fixed corner
    // stops at the smallest size rather than turning the picture over.
    //
    // snap { x, y } (optional): a point to land on. A box of fixed
    // proportions cannot put its corner on an arbitrary point, so it lines up
    // ONE edge with it - its side or its top or bottom, whichever leaves the
    // corner nearer the POINTER - which is what aligning a picture with a
    // drawing or another picture needs. (Nearer the snap point would always
    // pick the side of a landscape picture: the corner's miss on the other
    // axis is its proportions times smaller.)
    // Returns { x0, y0, w, h, snappedAxis } - snappedAxis 'x', 'y' or null.
    // ------------------------------------------------------------
    function Na__LeImgGeo__CornerScale(start, corner, aim, minSizeMm, snap) {
        const fixed  = Na__LeImgGeo__Corner(start, corner + 2);
        const held   = Na__LeImgGeo__Corner(start, corner);
        const dirX   = held.x >= fixed.x ? 1 : -1;
        const dirY   = held.y >= fixed.y ? 1 : -1;
        const aspect = start.w / Math.max(Na__LeImgGeo__EPSILON, start.h);
        const minW   = Math.max(0.5, Number(minSizeMm) || 1) * Math.max(1, aspect);
        // PROJECT THE POINTER ONTO THE DIAGONAL. t = 1 is the box as it was.
        const dx = held.x - fixed.x, dy = held.y - fixed.y;
        const len2 = (dx * dx) + (dy * dy);
        const t = len2 > 0 ? (((aim.x - fixed.x) * dx) + ((aim.y - fixed.y) * dy)) / len2 : 1;
        let w = Math.max(minW, t * start.w);
        let axis = null;
        if (snap && Number.isFinite(snap.x) && Number.isFinite(snap.y)) {
            const byX = Math.abs(snap.x - fixed.x);                              // <-- The picture's side edge on the point
            const byY = Math.abs(snap.y - fixed.y) * aspect;                     // <-- Its top or bottom edge on the point
            const cornerAt = (width) => ({ x : fixed.x + (dirX * width), y : fixed.y + (dirY * width / aspect) });
            const options = [ { w : byX, axis : 'x' }, { w : byY, axis : 'y' } ].filter((o) => o.w >= minW);
            if (options.length) {
                options.sort((a, b) => {
                    const pa = cornerAt(a.w), pb = cornerAt(b.w);
                    return Math.hypot(pa.x - aim.x, pa.y - aim.y) - Math.hypot(pb.x - aim.x, pb.y - aim.y);
                });
                w = options[0].w; axis = options[0].axis;
            }
        }
        const h  = w / aspect;
        const x0 = dirX > 0 ? fixed.x : fixed.x - w;
        const y0 = dirY > 0 ? fixed.y : fixed.y - h;
        return { x0 : x0, y0 : y0, x1 : x0 + w, y1 : y0 + h, w : w, h : h, snappedAxis : axis };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Resolution a Picture Prints At, Dots per Inch
    // ------------------------------------------------------------
    function Na__LeImgGeo__PrintDpi(rect, pixelW, pixelH, crop) {
        const kept = Na__LeImgGeo__KeptPixels(pixelW, pixelH, crop);
        const wIn  = Math.max(Na__LeImgGeo__EPSILON, rect.w / Na__LeImgGeo__MM_PER_INCH);
        return kept.w / wIn;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Pixel Size a Picture Goes Into the PDF At
    // ------------------------------------------------------------
    // The kept part resampled to maxDpi at the size it prints, never above
    // the pixels it has - enlarging adds bytes and no detail.
    // ------------------------------------------------------------
    function Na__LeImgGeo__PdfPixels(rect, pixelW, pixelH, crop, maxDpi) {
        const kept  = Na__LeImgGeo__KeptPixels(pixelW, pixelH, crop);
        const wantW = (rect.w / Na__LeImgGeo__MM_PER_INCH) * maxDpi;
        const scale = Math.min(1, wantW / kept.w);
        return { w : Math.max(1, Math.round(kept.w * scale)), h : Math.max(1, Math.round(kept.h * scale)) };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Size a Picture Is Stored At
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Greatest Common Divisor of Two Whole Numbers
    // ------------------------------------------------------------
    function Na__LeImgGeo__Gcd(a, b) {
        let x = Math.abs(Math.round(a)), y = Math.abs(Math.round(b));
        while (y) { const t = x % y; x = y; y = t; }
        return Math.max(1, x);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Pixels to Store a Picture At: { w, h }, or null When No Drawing Shows It
    // ------------------------------------------------------------
    // sourceW / sourceH: the dropped original. uses: [{ rect, crop }], every
    // place a drawing shows the picture - the same file on two sheets, or
    // copied, is stored once, for the largest. dpi: the print resolution
    // wanted (the PDF never uses more). maxEdgePx: the storage edge.
    //
    // THE WHOLE PICTURE IS KEPT: a crop only hides part of it, so the density
    // the kept part needs is asked of the whole, and Reset crop still has
    // the rest. NEVER ABOVE THE ORIGINAL - enlarging adds bytes and no
    // detail - nor above the storage edge, capped exactly as the drop caps
    // it, so a picture wanted at full size comes back to the very file the
    // drop made. And in the original's EXACT proportions where a whole
    // number of its smallest steps allows it (16 x 9 for a 3840 x 2160
    // render), rounded up a step, so a stored picture never pulls its box a
    // hair out of shape; otherwise to the nearest pixel.
    // ------------------------------------------------------------
    function Na__LeImgGeo__StoreSize(sourceW, sourceH, uses, dpi, maxEdgePx) {
        const sw   = Math.max(1, Math.round(Number(sourceW) || 1));
        const sh   = Math.max(1, Math.round(Number(sourceH) || 1));
        const list = (Array.isArray(uses) ? uses : []).filter((use) => use && use.rect && use.rect.w > 0 && use.rect.h > 0);
        if (!list.length) return null;
        const perMm = (Number(dpi) > 0 ? Number(dpi) : 300) / Na__LeImgGeo__MM_PER_INCH;
        let scale = 0;
        list.forEach((use) => {
            const c      = Na__LeImgGeo__CropOf(use.crop);
            const wholeW = use.rect.w / Math.max(Na__LeImgGeo__EPSILON, c.R - c.L);   // <-- Millimetres the whole picture would span at this size
            const wholeH = use.rect.h / Math.max(Na__LeImgGeo__EPSILON, c.B - c.T);
            scale = Math.max(scale, (wholeW * perMm) / sw, (wholeH * perMm) / sh);
        });
        const edge  = Number(maxEdgePx) > 0 ? Number(maxEdgePx) : Infinity;
        const cap   = Math.min(1, edge / Math.max(sw, sh));
        const floor = Math.min(cap, Na__LeImgGeo__MIN_STORE_PX / Math.max(sw, sh));
        scale = Math.max(floor, Math.min(cap, scale));
        const limit = { w : Math.max(1, Math.round(sw * cap)), h : Math.max(1, Math.round(sh * cap)) };   // <-- The drop's own size: the same arithmetic as Encode's
        const g = Na__LeImgGeo__Gcd(sw, sh), stepW = sw / g, stepH = sh / g;
        let w, h;
        if (stepW <= sw * scale * Na__LeImgGeo__EXACT_STEP) {
            const steps = Math.ceil(((sw * scale) / stepW) - 1e-6);
            w = stepW * steps; h = stepH * steps;
        } else {
            w = Math.round(sw * scale); h = Math.round(sh * scale);
        }
        if (w >= limit.w || h >= limit.h) return limit;
        return { w : Math.max(1, w), h : Math.max(1, h) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Stored File Far Enough From the Wanted Size to Cut Again
    // ------------------------------------------------------------
    // Either way: fewer pixels than a print needs, or more than it can use.
    // Within slack (a share of the width) it is left alone, so nudging a
    // picture a millimetre never makes a new file.
    // ------------------------------------------------------------
    function Na__LeImgGeo__NeedsRecut(have, want, slack) {
        if (!want) return false;
        const hw = Number(have && have.w) || 0, hh = Number(have && have.h) || 0;
        if (!(hw > 0) || !(hh > 0)) return true;
        const s = Number.isFinite(slack) ? Math.max(0, slack) : 0.05;
        return Math.abs(want.w - hw) > hw * s || Math.abs(want.h - hh) > hh * s;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Folder and File Names
// -----------------------------------------------------------------------------

    // FUNCTION | A Document Id Made Safe as a Folder Name
    // ------------------------------------------------------------
    // The composed id is already safe ("RB05_T01_D01"); a TYPED one may hold
    // anything, so every run of characters outside letters, digits, _ - and .
    // becomes one hyphen. The archive folder's name is never handed out, and
    // an id with nothing left in it takes the fallback (the sheet's own id).
    // ------------------------------------------------------------
    function Na__LeImgGeo__FolderFor(documentId, fallback, reserved) {
        const clean = (value) => String(value === undefined || value === null ? '' : value)
            .trim().replace(Na__LeImgGeo__FOLDER_CHARS, '-').replace(/-{2,}/g, '-')
            .replace(/^[^A-Za-z0-9]+/, '').replace(/[-.]+$/, '').slice(0, Na__LeImgGeo__FOLDER_MAX);
        let folder = clean(documentId);
        if (!folder || folder === reserved) folder = clean(fallback);
        if (!folder || folder === reserved) folder = 'Sheet';
        return folder;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Readable Part of a Stored File's Name, From the Dropped File's
    // ------------------------------------------------------------
    function Na__LeImgGeo__Slug(originalName) {
        const base = String(originalName || '').replace(/\\/g, '/').split('/').pop().replace(/\.[A-Za-z0-9]{1,5}$/, '');
        const slug = base.replace(/[^A-Za-z0-9_\-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[^A-Za-z0-9]+|[_\-]+$/g, '').slice(0, Na__LeImgGeo__SLUG_MAX).replace(/[_\-]+$/g, '');
        return slug || 'Image';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Stored File's Name: the Slug, Two Underscores, the Hash, the Type
    // ------------------------------------------------------------
    function Na__LeImgGeo__FileName(originalName, hashHex, extension) {
        const hash = String(hashHex || '').toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, Na__LeImgGeo__HASH_DIGITS).padEnd(Na__LeImgGeo__HASH_DIGITS, '0');
        const ext  = String(extension || 'webp').toLowerCase().replace(/^\./, '').replace('jpeg', 'jpg');
        return Na__LeImgGeo__Slug(originalName) + '__' + hash + '.' + ext;
    }
    // ------------------------------------------------------------


    // FUNCTION | Did This Feature Store That File (and so may it move it)
    // ------------------------------------------------------------
    function Na__LeImgGeo__IsManagedName(fileName) {
        return Na__LeImgGeo__MANAGED_NAME.test(String(fileName || ''));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images Geometry API
    // ------------------------------------------------------------
    export {
        Na__LeImgGeo__HASH_DIGITS,
        Na__LeImgGeo__Rect,
        Na__LeImgGeo__RectPoints,
        Na__LeImgGeo__Corner,
        Na__LeImgGeo__NormaliseCrop,
        Na__LeImgGeo__CropOf,
        Na__LeImgGeo__KeptAspect,
        Na__LeImgGeo__KeptPixels,
        Na__LeImgGeo__WholeRect,
        Na__LeImgGeo__ApplyCrop,
        Na__LeImgGeo__Enforce,
        Na__LeImgGeo__FitPlacement,
        Na__LeImgGeo__CornerScale,
        Na__LeImgGeo__PrintDpi,
        Na__LeImgGeo__PdfPixels,
        Na__LeImgGeo__StoreSize,
        Na__LeImgGeo__NeedsRecut,
        Na__LeImgGeo__FolderFor,
        Na__LeImgGeo__Slug,
        Na__LeImgGeo__FileName,
        Na__LeImgGeo__IsManagedName
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
