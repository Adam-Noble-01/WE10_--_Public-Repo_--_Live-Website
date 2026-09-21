// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OBJECT SNAP - GLYPHS
// =============================================================================
//
// FILE       : Na__LayoutEditor__ObjectSnap__Glyphs__.js
// NAMESPACE  : Na__LeOsnap
// MODULE     : Layout Editor - Object Snap - Glyphs
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The shape each kind of snap is marked with, and the little picture that explains it in the snap menu
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE GLYPHS ARE AUTOCAD'S, because anyone who has drawn in CAD already
//   reads them without being told:
//     Endpoint       a square            Perpendicular  a right angle, its corner boxed
//     Midpoint       a triangle          Centre         a circle
//     Intersection   a cross             Nearest        an hourglass
//   and two of this editor's own: a small ring with a dot for a point of the
//   drawing grid, and a dashed circle for the Dimension tool's inferred line.
// - ONE DRAWING, TWO USES. GlyphSvg is the marker that appears on the paper
//   at the point a snap found; IllustrationSvg is the picture beside that
//   mode's row in the snap menu - a line or two in grey, with the SAME glyph
//   drawn where that mode would find its point. Both come from one table, so
//   the menu can never show a shape the paper does not.
// - A GLYPH HAS NO COLOUR OF ITS OWN. It is stroked in currentColor over a
//   white casing, so it reads over black linework and over white paper alike,
//   and the stylesheet gives it the colour of WHAT WAS SNAPPED TO (purple for
//   a viewport's linework, blue for a vector, orange for text, red for a
//   dimension).
//
// INTEGRATION:
// - Na__LayoutEditor__ObjectSnap__Marker__ draws GlyphSvg on the paper.
// - Na__LayoutEditor__ObjectSnap__Menu__ draws IllustrationSvg in each row.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: eight glyphs and six menu illustrations.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Each Glyph, Drawn in a 24 by 24 Box About Its Middle (12, 12)
    // ------------------------------------------------------------
    // Path data only: the casing and the ink are the same path stroked twice.
    // `fill` marks the one glyph with a solid part (the grid's centre dot).
    // ------------------------------------------------------------
    const Na__LeOsnap__GLYPHS = Object.freeze({
        end   : { path : 'M5 5 H19 V19 H5 Z' },
        mid   : { path : 'M12 4.5 L20 18.5 H4 Z' },
        int   : { path : 'M5 5 L19 19 M19 5 L5 19' },
        perp  : { path : 'M5 4 V19 H20 M5 12 H12 V19' },
        cen   : { path : 'M12 4.5 A7.5 7.5 0 1 0 12 19.5 A7.5 7.5 0 1 0 12 4.5 Z' },
        near  : { path : 'M5 5 H19 L5 19 H19 Z' },
        grid  : { path : 'M12 3 A9 9 0 1 0 12 21 A9 9 0 1 0 12 3 Z', fill : 'M12 9.2 A2.8 2.8 0 1 0 12 14.8 A2.8 2.8 0 1 0 12 9.2 Z' },   // <-- Drawn full size: the stylesheet scales it down by the grid config's Snap MarkerScale
        infer : { path : 'M12 4.5 A7.5 7.5 0 1 0 12 19.5 A7.5 7.5 0 1 0 12 4.5 Z', dash : '3.2 2.6' }
    });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Menu's Pictures: Grey Lines in a 44 by 28 Box, and Where the Glyph Sits
    // ------------------------------------------------------------
    // lines is path data for what is being snapped to; at is the point that
    // mode would find, where the glyph is drawn at GLYPH_SCALE.
    // ------------------------------------------------------------
    const Na__LeOsnap__ILLUSTRATION_SCALE = 0.58;
    const Na__LeOsnap__ILLUSTRATIONS = Object.freeze({
        end  : { lines : 'M5 23 L33 8',                         at : [ 33, 8 ] },
        mid  : { lines : 'M5 23 L39 5',                         at : [ 22, 14 ] },
        int  : { lines : 'M4 22 L40 7 M8 5 L36 24',             at : [ 21.2, 14.8 ] },
        perp : { lines : 'M3 22 H41 M27 3 V22',                 at : [ 27, 22 ], shift : [ 4, -4.4 ] },
        cen  : { lines : 'M7 4 H37 V24 H7 Z',                   at : [ 22, 14 ] },
        near : { lines : 'M4 22 L40 6',                         at : [ 15, 17.1 ] }
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Glyph's Casing and Ink, as SVG Markup
    // ------------------------------------------------------------
    // The casing is white and wider, so the glyph stays legible wherever it
    // lands; the ink is currentColor, which the stylesheet sets from what was
    // snapped to. Widths are in the glyph's own 24-unit box.
    // ------------------------------------------------------------
    function Na__LeOsnap__GlyphParts(kind, inkWidth) {
        const glyph = Na__LeOsnap__GLYPHS[kind] || Na__LeOsnap__GLYPHS.end;
        const dash  = glyph.dash ? ' stroke-dasharray="' + glyph.dash + '"' : '';
        const round = ' stroke-linejoin="round" stroke-linecap="round"';
        return '<path d="' + glyph.path + '" fill="none" stroke="#ffffff" stroke-width="' + (inkWidth + 2.2) + '"' + round + '/>' +
               '<path class="na-le-osnap__tint" d="' + glyph.path + '" stroke="none"/>' +
               '<path d="' + glyph.path + '" fill="none" stroke="currentColor" stroke-width="' + inkWidth + '"' + dash + round + '/>' +
               (glyph.fill ? '<path d="' + glyph.fill + '" fill="currentColor" stroke="none"/>' : '');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Marker for One Kind of Snap, as an SVG Element's Markup
    // ------------------------------------------------------------
    // Sized by the element it is put in (width and height 100%), so the marker
    // module decides how big it is on screen.
    // ------------------------------------------------------------
    function Na__LeOsnap__GlyphSvg(kind) {
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" focusable="false" aria-hidden="true">' +
               Na__LeOsnap__GlyphParts(kind, 2.2) + '</svg>';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Menu's Picture of One Snap Mode, as an SVG Element's Markup
    // ------------------------------------------------------------
    // The lines being snapped to in grey, and the mode's own glyph where it
    // would find its point. Null for a kind the menu does not list.
    // ------------------------------------------------------------
    function Na__LeOsnap__IllustrationSvg(kind) {
        const picture = Na__LeOsnap__ILLUSTRATIONS[kind];
        if (!picture) return null;
        const scale = Na__LeOsnap__ILLUSTRATION_SCALE;
        const shift = picture.shift || [ 0, 0 ];
        const tx = picture.at[0] + shift[0] - (12 * scale), ty = picture.at[1] + shift[1] - (12 * scale);
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 28" width="44" height="28" focusable="false" aria-hidden="true">' +
               '<path class="na-le-osnap-menu__lines" d="' + picture.lines + '" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
               '<g transform="translate(' + tx.toFixed(2) + ' ' + ty.toFixed(2) + ') scale(' + scale + ')">' + Na__LeOsnap__GlyphParts(kind, 2.6) + '</g>' +
               '</svg>';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Object Snap Glyphs
    // ------------------------------------------------------------
    export {
        Na__LeOsnap__GlyphSvg,
        Na__LeOsnap__IllustrationSvg
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
