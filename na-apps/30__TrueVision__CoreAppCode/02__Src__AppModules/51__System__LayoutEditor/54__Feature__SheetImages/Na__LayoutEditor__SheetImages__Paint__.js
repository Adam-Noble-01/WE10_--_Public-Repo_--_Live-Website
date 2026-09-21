// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES - PAINT
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__Paint__.js
// NAMESPACE  : Na__LeImgDraw
// MODULE     : Layout Editor - Sheet Images - Paint
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Describe a picture shape as one 'picture' primitive: its box, its crop, its source, its frame and shadow
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - The shape painter (Na__LeShapeGeo__Push) hands a shape carrying
//   Shape__Image here instead of drawing it as a vector. What comes back is
//   one 'picture' primitive, painted by Na__LayoutEditor__SheetImages__Painter__
//   on both surfaces, so the screen and the PDF agree on the box, the crop,
//   the frame and the shadow by construction.
// - The source is asked for on every paint (Na__LeImgSrc__Url) and answers at
//   once from its cache; the first ask for a picture starts its load and the
//   primitive says 'loading' until it lands, which repaints the sheet.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Setup, Geometry, Painter Constants and the Source
    // ------------------------------------------------------------
    import { Na__LeImgCfg__Frame, Na__LeImgCfg__Label } from './Na__LayoutEditor__SheetImages__Setup__.js';
    import { Na__LeImgGeo__Rect, Na__LeImgGeo__CropOf } from './Na__LayoutEditor__SheetImages__Geometry__.js';
    import { Na__LeImgPaint__KIND, Na__LeImgPaint__STATE_READY, Na__LeImgPaint__STATE_LOADING, Na__LeImgPaint__STATE_MISSING } from './Na__LayoutEditor__SheetImages__Painter__.js';
    import { Na__LeImgSrc__Url, Na__LeImgSrc__State, Na__LeImgSrc__READY, Na__LeImgSrc__MISSING } from './Na__LayoutEditor__SheetImages__Source__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Picture Block of a Shape, or null
    // ------------------------------------------------------------
    function Na__LeImgDraw__Block(shape) {
        const block = shape ? shape.Shape__Image : null;
        return (block && typeof block === 'object' && !Array.isArray(block) && typeof block.Image__File === 'string' && block.Image__File) ? block : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Short Stable Name for a Set of Values (djb2, hex)
    // ------------------------------------------------------------
    function Na__LeImgDraw__Hash(text) {
        let h = 5381;
        for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
        return h.toString(16);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Soft Drop Shadow a Framed Picture Casts, or null
    // ------------------------------------------------------------
    // A Gaussian blur of the picture's box, dropped by the offsets - the same
    // numbers on both surfaces: an SVG feDropShadow on the screen, the same
    // blur pre-rendered as a transparent PNG in the PDF (Encode ShadowPng).
    // The frame and the shadow are one switch. A picture with transparency
    // casts none: under a cut-out a box-shaped shadow would show.
    //
    // THE FILTER'S NAME IS ITS SETTINGS. Every picture's SVG carries its own
    // copy of the filter, and an id can only mean one thing on a page, so the
    // id is made from the shadow settings and the size of the region the blur
    // needs (as a share of the picture, in 5% steps): two pictures that share
    // an id share an identical filter, whichever copy the browser finds first.
    // ------------------------------------------------------------
    function Na__LeImgDraw__ShadowOf(rect, block) {
        const frame = Na__LeImgCfg__Frame();
        if (!block || block.Image__Frame === false || !frame.shadow || block.Image__Alpha === true) return null;
        if (!(rect.w > 0) || !(rect.h > 0)) return null;
        const blur   = frame.shadowBlurMm;
        const margin = (3 * blur) + Math.max(Math.abs(frame.shadowOffsetXMm), Math.abs(frame.shadowOffsetYMm));   // <-- Three standard deviations hold all of a Gaussian that shows
        const tag    = Na__LeImgDraw__Hash([ frame.shadowColour, frame.shadowOpacity, blur, frame.shadowOffsetXMm, frame.shadowOffsetYMm ].join('|'));
        const region = Math.min(300, Math.max(10, Math.ceil((100 * margin / Math.min(rect.w, rect.h)) / 5) * 5));
        return {
            Colour    : frame.shadowColour,
            Opacity   : frame.shadowOpacity,
            BlurMm    : blur,
            OffsetXMm : frame.shadowOffsetXMm,
            OffsetYMm : frame.shadowOffsetYMm,
            MarginMm  : margin,
            RegionPct : region,
            FilterId  : 'naLeImgShadow_' + tag + '_' + region,
            PdfKey    : 'shadow|' + tag + '|' + rect.w.toFixed(1) + 'x' + rect.h.toFixed(1)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Key a Picture's PDF Copy Is Held Under
    // ------------------------------------------------------------
    // The file and the kept part: the same picture cropped the same way is
    // embedded once, however many times it is placed; a different crop is a
    // different cut. The printed size is left out on purpose - two copies of
    // one picture at two sizes share the larger cut.
    // ------------------------------------------------------------
    function Na__LeImgDraw__PdfKey(block) {
        const c = Na__LeImgGeo__CropOf(block.Image__Crop);
        return block.Image__File + '|' + [ c.L, c.T, c.R, c.B ].map((n) => Math.round(n * 1e5)).join(',');
    }
    // ------------------------------------------------------------


    // FUNCTION | Push a Picture Shape as One 'picture' Primitive
    // ------------------------------------------------------------
    // Returns true when something was pushed.
    // ------------------------------------------------------------
    function Na__LeImgDraw__Push(list, shape) {
        const block = Na__LeImgDraw__Block(shape);
        if (!block || !Array.isArray(list)) return false;
        const rect = Na__LeImgGeo__Rect(shape.Shape__Points);
        if (!(rect.w > 0) || !(rect.h > 0)) return false;
        const state = Na__LeImgSrc__State(block.Image__Folder, block.Image__File);
        const href  = state === Na__LeImgSrc__READY ? Na__LeImgSrc__Url(block.Image__Folder, block.Image__File) : null;
        const frame = Na__LeImgCfg__Frame();
        const on    = block.Image__Frame !== false;
        list.push({
            Kind     : Na__LeImgPaint__KIND,
            X        : rect.x0,
            Y        : rect.y0,
            WidthMm  : rect.w,
            HeightMm : rect.h,
            PixelW   : block.Image__PixelW,
            PixelH   : block.Image__PixelH,
            Crop     : Na__LeImgGeo__CropOf(block.Image__Crop),
            Href     : href,
            State    : href ? Na__LeImgPaint__STATE_READY : (state === Na__LeImgSrc__MISSING ? Na__LeImgPaint__STATE_MISSING : Na__LeImgPaint__STATE_LOADING),
            Caption  : href ? '' : (state === Na__LeImgSrc__MISSING
                ? Na__LeImgCfg__Label('Missing', 'Picture not found: {file}', { file : block.Image__Name || block.Image__File })
                : Na__LeImgCfg__Label('Loading', 'Loading picture')),
            Frame    : on ? { Colour : frame.colour, WidthMm : frame.widthMm } : null,
            Shadow   : Na__LeImgDraw__ShadowOf(rect, block),
            PdfKey   : Na__LeImgDraw__PdfKey(block)
        });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images Paint API
    // ------------------------------------------------------------
    export {
        Na__LeImgDraw__Block,
        Na__LeImgDraw__ShadowOf,
        Na__LeImgDraw__PdfKey,
        Na__LeImgDraw__Push
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
