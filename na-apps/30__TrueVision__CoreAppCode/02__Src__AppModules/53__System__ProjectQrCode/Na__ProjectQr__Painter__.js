// =============================================================================
// TRUEVISION3D - PROJECT QR CODE - PAINTER
// =============================================================================
//
// FILE       : Na__ProjectQr__Painter__.js
// NAMESPACE  : Na__QrPaint
// MODULE     : Project QR Code - Painter
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw an encoded symbol as vector marks, to SVG and to jsPDF
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Three ways out for one symbol, because the pack is printed three ways:
//   - SvgGroup    : a <g> in the caller's own units. The sheet chrome's viewBox
//                   is the paper in millimetres, so the symbol lands on the
//                   screen sheet at its printed size.
//   - SvgDocument : a whole <svg> for an HTML page (the specification's reading
//                   view), sized by CSS. Carries its own quiet zone.
//   - DrawPdf     : straight into a jsPDF document, in the document's unit.
//                   The sheet exporter reaches it through the chrome; the
//                   Drawing Register, which draws raw jsPDF, calls it direct.
// - THE SYMBOL IS VECTOR EVERYWHERE, never a raster. It stays sharp at any zoom
//   and any print size, and a project's code is 217 rectangles in one path.
// - THE DARK MODULES ARE ONE PATH, NOT ONE RECTANGLE EACH. Abutting filled
//   rectangles are anti-aliased one at a time, so a viewer leaves a hairline
//   of background showing between two that share an edge - across a QR symbol
//   that is a faint grid through every finder pattern. One path is filled
//   once, so its runs have no seams to show.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetChrome__ hands its 'qr' primitive to SvgGroup and
//   DrawPdf, the way it hands a gradient to the gradient tool.
// - Imports nothing: a symbol and numbers in, markup or drawing calls out.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026). The Lantern Designer
//                   paints its symbol inside its own SheetChrome, one rectangle
//                   per run; the single path is new here.
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Fallback Colours and the Standalone Quiet Zone
    // ------------------------------------------------------------
    const Na__QrPaint__DARK_FALLBACK  = '#000000';
    const Na__QrPaint__LIGHT_FALLBACK = '#ffffff';
    const Na__QrPaint__QUIET_MODULES  = 4;                                       // <-- ISO/IEC 18004: four modules of clear light margin on every side
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Whether a Value Is a Symbol the Encoder Returned
    // ------------------------------------------------------------
    function Na__QrPaint__IsSymbol(symbol) {
        return !!symbol && Number.isFinite(symbol.Size) && symbol.Size > 0 && Array.isArray(symbol.Runs);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Six Digit Hex Colour, or the Fallback
    // ------------------------------------------------------------
    // Checked here rather than handed on as a string, so a malformed config
    // value cannot paint a symbol in a colour a camera cannot read.
    // ------------------------------------------------------------
    function Na__QrPaint__Hex(colour, fallback) {
        const value = String(colour || '').trim();
        return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hex Colour to an RGB Triplet
    // ------------------------------------------------------------
    function Na__QrPaint__Rgb(hex) {
        return { R : parseInt(hex.substring(1, 3), 16), G : parseInt(hex.substring(3, 5), 16), B : parseInt(hex.substring(5, 7), 16) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Dark Modules as One SVG Path, in Module Units
    // ------------------------------------------------------------
    // Whole numbers only, so a project's 29 module symbol is under 3 kB of
    // markup and nothing is lost to rounding: the scale rides on the group's
    // transform.
    // ------------------------------------------------------------
    function Na__QrPaint__PathData(symbol) {
        let d = '';
        for (let i = 0; i < symbol.Runs.length; i++) {
            const run = symbol.Runs[i];
            d += 'M' + run.Col + ' ' + run.Row + 'h' + run.Length + 'v1h-' + run.Length + 'z';
        }
        return d;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Size of One Module When a Symbol Is Drawn at a Given Size
    // ------------------------------------------------------------
    // What decides whether a phone can read the print. Callers that lay a
    // symbol out report this, so a cell too small for its symbol says so.
    // ------------------------------------------------------------
    function Na__QrPaint__ModuleSize(symbol, size) {
        return Na__QrPaint__IsSymbol(symbol) && size > 0 ? size / symbol.Size : 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Symbol as an SVG Group, in the Caller's Units
    // ------------------------------------------------------------
    // x, y and size are the symbol's own square, edge to edge: the caller keeps
    // the quiet zone clear around it. The light square is drawn first so the
    // symbol reads over whatever the sheet has underneath.
    //
    // shape-rendering crispEdges stops the browser anti-aliasing the module
    // edges into grey, which is what a camera reads as a soft module.
    // ------------------------------------------------------------
    function Na__QrPaint__SvgGroup(symbol, x, y, size, darkColour, lightColour) {
        if (!Na__QrPaint__IsSymbol(symbol) || !(size > 0)) return '';
        const dark  = Na__QrPaint__Hex(darkColour,  Na__QrPaint__DARK_FALLBACK);
        const light = Na__QrPaint__Hex(lightColour, Na__QrPaint__LIGHT_FALLBACK);
        const scale = size / symbol.Size;
        return '<g shape-rendering="crispEdges" transform="translate(' + x + ' ' + y + ') scale(' + scale + ')">' +
               '<rect x="0" y="0" width="' + symbol.Size + '" height="' + symbol.Size + '" fill="' + light + '"/>' +
               '<path d="' + Na__QrPaint__PathData(symbol) + '" fill="' + dark + '"/></g>';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Symbol as a Whole SVG Document, for an HTML Page
    // ------------------------------------------------------------
    // The viewBox is in modules and includes the quiet zone, so whatever size
    // CSS gives the element, the clear margin scales with it and cannot be
    // styled away. options: { darkColour, lightColour, quietModules, cssClass,
    // title }. The title is what a screen reader announces.
    // ------------------------------------------------------------
    function Na__QrPaint__SvgDocument(symbol, options) {
        if (!Na__QrPaint__IsSymbol(symbol)) return '';
        const settings = (options && typeof options === 'object') ? options : {};
        const quiet    = Number.isFinite(settings.quietModules) && settings.quietModules >= 0 ? settings.quietModules : Na__QrPaint__QUIET_MODULES;
        const dark     = Na__QrPaint__Hex(settings.darkColour,  Na__QrPaint__DARK_FALLBACK);
        const light    = Na__QrPaint__Hex(settings.lightColour, Na__QrPaint__LIGHT_FALLBACK);
        const side     = symbol.Size + (quiet * 2);
        const escape   = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const title    = settings.title ? '<title>' + escape(settings.title) + '</title>' : '';

        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + side + ' ' + side + '" shape-rendering="crispEdges"' +
               (settings.cssClass ? ' class="' + escape(settings.cssClass) + '"' : '') +
               (settings.title ? ' role="img"' : ' aria-hidden="true" focusable="false"') + '>' + title +
               '<rect x="0" y="0" width="' + side + '" height="' + side + '" fill="' + light + '"/>' +
               '<path transform="translate(' + quiet + ' ' + quiet + ')" d="' + Na__QrPaint__PathData(symbol) + '" fill="' + dark + '"/></svg>';
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw a Symbol Into a jsPDF Document
    // ------------------------------------------------------------
    // x, y and size are in the document's own unit (millimetres for every
    // document this app makes) and describe the symbol edge to edge.
    //
    // A rectangle given a null style is added to the current path and not
    // painted, so every run joins one path and fill() paints them together -
    // jsPDF's own idiom, the one the sheet chrome's clip already relies on.
    // A jsPDF without fill() paints run by run instead: seams, but a symbol.
    // ------------------------------------------------------------
    function Na__QrPaint__DrawPdf(doc, symbol, x, y, size, darkColour, lightColour) {
        if (!doc || !Na__QrPaint__IsSymbol(symbol) || !(size > 0)) return false;
        const dark   = Na__QrPaint__Rgb(Na__QrPaint__Hex(darkColour,  Na__QrPaint__DARK_FALLBACK));
        const light  = Na__QrPaint__Rgb(Na__QrPaint__Hex(lightColour, Na__QrPaint__LIGHT_FALLBACK));
        const module = size / symbol.Size;
        const onePath = typeof doc.fill === 'function';

        doc.setFillColor(light.R, light.G, light.B);
        doc.rect(x, y, size, size, 'F');

        doc.setFillColor(dark.R, dark.G, dark.B);
        for (let i = 0; i < symbol.Runs.length; i++) {
            const run = symbol.Runs[i];
            doc.rect(x + (run.Col * module), y + (run.Row * module), run.Length * module, module, onePath ? null : 'F');
        }
        if (onePath) doc.fill();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Project QR Code Painter API
    // ------------------------------------------------------------
    export {
        Na__QrPaint__ModuleSize,
        Na__QrPaint__SvgGroup,
        Na__QrPaint__SvgDocument,
        Na__QrPaint__DrawPdf
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
