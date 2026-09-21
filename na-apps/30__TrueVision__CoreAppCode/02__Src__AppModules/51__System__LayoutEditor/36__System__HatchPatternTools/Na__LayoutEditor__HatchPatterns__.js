// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - HATCH PATTERNS
// =============================================================================
//
// FILE       : Na__LayoutEditor__HatchPatterns__.js
// NAMESPACE  : Na__LeHatch
// MODULE     : Layout Editor - Hatch Pattern Library
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Load the hatch pattern library and turn a pattern into SVG
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - The library lives OUTSIDE the module tree, at
//   52__LayoutEditor__HatchPatternLibrary, beside 51__LayoutEditor__UserScrapbookContent.
//   Its root index names the packs; each pack folder holds its own index and its
//   pattern files. NOTHING LISTS A DIRECTORY - not GitHub Pages, not the Flask
//   dev server - so a checked-in index is what makes the library readable.
// - A pattern is a repeating TILE measured in PAPER millimetres: glyph shapes
//   placed at hand-authored positions. Paper units mean a tree is the same size
//   on the sheet at 1:200 and at 1:500, which is what a drawn symbol does.
// - THE TILE IS TRANSPARENT. It paints glyphs and never a background: the solid
//   wash beneath is the site plan composite's fill deck, a separate layer with
//   its own colour and opacity, so either can be switched off alone.
// - Rendering is a native SVG <pattern> in the sheet's <defs>, transformed by
//   the drawing scale, the per-use scale and the per-use rotation. The browser
//   tiles it, so a woodland of any size costs one <path> and one <pattern>.
//
// INTEGRATION:
// - Na__LeHatch__Ready() must be awaited before the first sheet paints; the mode
//   controller joins it to its Promise.all.
// - Read by the site plan viewport painter for the pattern deck, and by the
//   Patterns panel for its tiles.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.3.0
// - A USE OF A PATTERN MAY SET ITS OWN LINE WEIGHT AND LINE COLOUR. Adam:
//   "A line thickness control for the pattern. A line colour for the pattern,
//   so that the vectors that are generated in the pattern get a colour and a
//   line thickness ... You basically take that same geometry that generates
//   them, but then give more control. Pull the standard ones in for when you
//   first load that, but then have controls to be able to modify it."
//   Hatch__StrokePt is a printed weight in POINTS, the unit every other weight
//   in the editor is typed in, and unlike the pattern's own Defaults__StrokeMm
//   it does NOT grow with the pattern scale: a typed weight is the weight that
//   prints. Hatch__Colour is a hex. Both are absent until somebody sets them,
//   and absent means the pattern's standard - so every hatch saved before this
//   paints exactly as it did. PatternDef, SvgPaint and DrawPdf take strokePt;
//   Effective and Token carry both for a site plan layer; StandardStrokePt and
//   StandardColour say what "standard" is, for a panel to show.
// - THE SCREEN NOW DRAWS WHAT CROSSES A TILE SEAM. A browser clips a <pattern>
//   at its tile edge and the PDF stamper does not, which is why every glyph so
//   far had to sit wholly inside its tile or carry a hand-placed knit copy. A
//   LINE hatch cannot: brickwork's diagonals cross every seam, and a line
//   clipped square at a seam it meets at 45 degrees loses a sliver of its edge
//   there, more the heavier it is drawn. PatternDef therefore also draws each
//   neighbouring tile's marks wherever their ink reaches into this tile, so
//   the two halves of anything on a seam are both painted - what the PDF has
//   always done by not clipping. A mark whose ink stays inside its tile gets
//   no copy, and a knit copy placed by hand is not made twice, so Mixed
//   Woodland, Grassland and Rough Grassland are written byte for byte as they
//   were. PONDS & LAKES IS THE ONE THAT CHANGES, and rightly: its two lowest
//   ripples touch the tile's BOTTOM seam, which nobody had knitted, so the
//   screen has always shaved half a line width off those two troughs where the
//   PDF printed them whole. They now get their four copies from the tiles above.
// - A pack may name the ink its library tiles are drawn in (Pack__SwatchInk),
//   because the green that suits a woodland makes a poor brick wall.
//
// 21-Sep-2026 - Version 1.2.0
// - A pattern may carry its OWN INK. Defaults__StrokeColour written as a hex is
//   parsed into Pattern__Ink; 'inherit' (every pattern before this) parses to
//   null and keeps taking the layer's line colour. The site plan build applies
//   it, and a library swatch shows it. Wanted by the Grassland and Rough
//   Grassland patterns, whose tags draw grey edges over green tufts.
// - (1.1.0, recorded in the site plan composites plan ledger, added
//   TilePolylines and DrawPdf without an entry here.)
//
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation. Library loading, pattern resolution, and SVG <pattern>
//   generation for the site plan composite's middle deck.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Library Lives
    // ------------------------------------------------------------
    // Resolved from this module's own URL, so it works on localhost, on a plain
    // static server and on the live site with no environment test - the same way
    // the Custom Scrapbook finds its content folder.
    // ------------------------------------------------------------
    const Na__LeHatch__APP_ROOT   = new URL('../../../', import.meta.url);
    const Na__LeHatch__FOLDER     = '52__LayoutEditor__HatchPatternLibrary';
    const Na__LeHatch__INDEX_FILE = 'HatchLibrary__Index__.json';
    const Na__LeHatch__PACK_FILE  = 'HatchPack__Index__.json';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Record Fields
    // ------------------------------------------------------------
    const Na__LeHatch__FIELD     = 'Viewport__SitePlanHatches';                 // <-- Per-viewport pattern overrides
    const Na__LeHatch__CAT_FIELD = 'Hatches__Categories';
    const Na__LeHatch__INHERIT   = 'inherit';                                   // <-- Take the layer's own line colour
    // ------------------------------------------------------------

    // MODULE CONSTANTS | A Use's Own Line Weight, in Printed Points
    // ------------------------------------------------------------
    // Held here rather than read from the editor's config so this module stays
    // a leaf: the record layer imports it, and the config imports nothing of
    // the hatches'. The bounds are only what a RECORD may hold - a panel offers
    // the editor's own lineweight range, which sits inside them.
    // ------------------------------------------------------------
    const Na__LeHatch__PT_TO_MM      = 25.4 / 72;
    const Na__LeHatch__MIN_STROKE_PT = 0.01;
    const Na__LeHatch__MAX_STROKE_PT = 20;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Session State
    // ------------------------------------------------------------
    let   Na__LeHatch__Loaded   = false;
    let   Na__LeHatch__Loading  = null;                                         // <-- The one load in flight
    const Na__LeHatch__Packs    = [];                                           // <-- [{ Pack__Key, Pack__Label, Pack__Patterns: [] }]
    const Na__LeHatch__ByKey    = new Map();                                    // <-- Pattern key -> resolved pattern
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading the Library
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Library URL, Path Parts Encoded
    // ------------------------------------------------------------
    // Encoded per part because a pack folder or a file name may hold a character
    // a URL minds - the library's own reference sheet is called
    // "OS_Symbol__Examples__Woodland&Water__.png".
    // ------------------------------------------------------------
    function Na__LeHatch__Url(...parts) {
        const path = [ Na__LeHatch__FOLDER, ...parts ].map(encodeURIComponent).join('/');
        return new URL(path, Na__LeHatch__APP_ROOT).href;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch One JSON File, or null
    // ------------------------------------------------------------
    async function Na__LeHatch__FetchJson(url) {
        try {
            const response = await fetch(url, { cache : 'no-store' });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            return null;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The One Block in a File Whose Key Ends With a Suffix
    // ------------------------------------------------------------
    // A pattern file's blocks are named for the pattern - HatchPattern__MixedWoodland__Tile -
    // so they are found by their ENDING, not by a fixed key. That keeps the
    // three-stage naming readable without the loader having to know the name.
    // ------------------------------------------------------------
    function Na__LeHatch__Block(doc, suffix) {
        if (!doc || typeof doc !== 'object') return null;
        const key = Object.keys(doc).find((name) => name.endsWith(suffix));
        return key ? doc[key] : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Pattern File Into the Shape the Renderer Wants
    // ------------------------------------------------------------
    function Na__LeHatch__Parse(doc, packKey) {
        const identity = Na__LeHatch__Block(doc, '__Identity');
        const tile     = Na__LeHatch__Block(doc, '__Tile');
        const defaults = Na__LeHatch__Block(doc, '__Defaults') || {};
        const glyphs   = Na__LeHatch__Block(doc, '__Glyphs')   || {};
        const places   = Na__LeHatch__Block(doc, '__Placements');
        const bounds   = Na__LeHatch__Block(doc, '__Bounds')   || {};

        if (!identity || !tile || !Array.isArray(places)) return null;
        const width  = Number(tile.Tile__WidthMm);
        const height = Number(tile.Tile__HeightMm);
        if (!(width > 0) || !(height > 0)) return null;

        const shapes = [];
        Object.keys(glyphs).forEach((name) => {
            const glyph = glyphs[name];
            if (!glyph || typeof glyph !== 'object' || typeof glyph.Glyph__Path !== 'string') return;
            shapes.push({
                Glyph__Name : name,
                Glyph__Path : glyph.Glyph__Path,
                Glyph__Fill : typeof glyph.Glyph__Fill === 'string' ? glyph.Glyph__Fill : 'none'
            });
        });
        if (!shapes.length) return null;

        const byName = new Map(shapes.map((s) => [ s.Glyph__Name, s ]));
        const marks  = places
            .filter((p) => p && byName.has(p.Place__Glyph) && Number.isFinite(p.Place__XMm) && Number.isFinite(p.Place__YMm))
            .map((p) => ({ Mark__Glyph : byName.get(p.Place__Glyph), Mark__XMm : p.Place__XMm, Mark__YMm : p.Place__YMm }));
        if (!marks.length) return null;

        const num = (value, fallback) => Number.isFinite(value) ? value : fallback;
        return {
            Pattern__Key         : identity.Identity__Key,
            Pattern__Label       : identity.Identity__Label || identity.Identity__Key,
            Pattern__Group       : identity.Identity__Group || '',
            Pattern__Note        : identity.Identity__Note  || '',
            Pattern__PackKey     : packKey,
            Pattern__TileWidthMm : width,
            Pattern__TileHeightMm: height,
            Pattern__RowOffsetMm : num(tile.Tile__RowOffsetMm, 0),
            Pattern__Marks       : marks,
            Pattern__StrokeMm    : num(defaults.Defaults__StrokeMm, 0.18),
            Pattern__StrokeColour: typeof defaults.Defaults__StrokeColour === 'string' ? defaults.Defaults__StrokeColour : Na__LeHatch__INHERIT,
            // THE PATTERN'S OWN INK, or null when it inherits the layer's.
            // Resolved once here so no painter has to validate a colour string.
            // Grass is the case that needs it: the Grassland tag draws its edges
            // in the OS base map grey, so an inherited ink would paint grey
            // tufts. Anything that is not a six-digit hex - 'inherit', a typo -
            // is null, and the layer's line colour applies as it always did.
            Pattern__Ink         : /^#[0-9a-fA-F]{6}$/.test(String(defaults.Defaults__StrokeColour || '')) ? defaults.Defaults__StrokeColour : null,
            Pattern__Opacity     : num(defaults.Defaults__Opacity, 1),
            Pattern__Scale       : num(defaults.Defaults__Scale, 1),
            Pattern__RotationDeg : num(defaults.Defaults__RotationDeg, 0),
            Pattern__MinScale    : num(bounds.Bounds__MinScale, 0.25),
            Pattern__MaxScale    : num(bounds.Bounds__MaxScale, 4),
            Pattern__StepScale   : num(bounds.Bounds__StepScale, 0.05),
            Pattern__RotationStep: num(bounds.Bounds__RotationStepDeg, 15)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the Library Once
    // ------------------------------------------------------------
    // Never throws and never rejects. A missing library, a missing pack or a
    // broken pattern file leaves the editor working with fewer patterns, because
    // a hatch is decoration - it must not be able to stop a drawing opening.
    // ------------------------------------------------------------
    function Na__LeHatch__Ready() {
        if (Na__LeHatch__Loaded) return Promise.resolve();
        if (Na__LeHatch__Loading) return Na__LeHatch__Loading;

        Na__LeHatch__Loading = (async () => {
            const index = await Na__LeHatch__FetchJson(Na__LeHatch__Url(Na__LeHatch__INDEX_FILE));
            const packs = index ? Na__LeHatch__Block(index, '__Packs') : null;

            if (!Array.isArray(packs)) {
                console.warn('[TrueVision3D] Hatch pattern library not found; the Patterns panel will be empty.');
            } else {
                for (const entry of packs) {
                    if (!entry || typeof entry.Pack__Folder !== 'string') continue;

                    const packDoc = await Na__LeHatch__FetchJson(Na__LeHatch__Url(entry.Pack__Folder, Na__LeHatch__PACK_FILE));
                    const listed  = packDoc ? Na__LeHatch__Block(packDoc, '__Patterns') : null;
                    if (!Array.isArray(listed) || !listed.length) continue;      // <-- An empty or index-less pack costs nothing

                    // THE INK A PACK'S LIBRARY TILES ARE DRAWN IN, from the pack's own
                    // index. Only for the panel's tiles, and only for a pattern with
                    // no ink of its own; a pack that names none keeps the woodland green.
                    const about     = Na__LeHatch__Block(packDoc, '__Pack') || {};
                    const swatchInk = /^#[0-9a-fA-F]{6}$/.test(String(about.Pack__SwatchInk || '')) ? about.Pack__SwatchInk : null;
                    const pack = { Pack__Key : entry.Pack__Key, Pack__Label : entry.Pack__Label || entry.Pack__Key, Pack__SwatchInk : swatchInk, Pack__Patterns : [] };
                    for (const row of listed) {
                        if (!row || typeof row.Pattern__File !== 'string') continue;
                        const doc = await Na__LeHatch__FetchJson(Na__LeHatch__Url(entry.Pack__Folder, row.Pattern__File));
                        const pattern = doc ? Na__LeHatch__Parse(doc, pack.Pack__Key) : null;
                        if (!pattern) {
                            console.warn(`[TrueVision3D] Hatch pattern ${row.Pattern__File} could not be read; skipped.`);
                            continue;
                        }
                        pack.Pack__Patterns.push(pattern);
                        Na__LeHatch__ByKey.set(pattern.Pattern__Key, pattern);
                    }
                    if (pack.Pack__Patterns.length) Na__LeHatch__Packs.push(pack);
                }
            }

            Na__LeHatch__Loaded = true;
            const total = Na__LeHatch__ByKey.size;
            console.log(`[TrueVision3D] Hatch patterns: ${total} pattern(s) in ${Na__LeHatch__Packs.length} pack(s).`);
        })();

        return Na__LeHatch__Loading;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Library
// -----------------------------------------------------------------------------

    // FUNCTION | Readers
    // ------------------------------------------------------------
    function Na__LeHatch__IsLoaded()      { return Na__LeHatch__Loaded; }
    function Na__LeHatch__GetPacks()      { return Na__LeHatch__Packs; }
    function Na__LeHatch__Get(patternKey) { return Na__LeHatch__ByKey.get(patternKey) || null; }
    // ------------------------------------------------------------


    // FUNCTION | Clamp a Scale or a Rotation to a Pattern's Own Bounds
    // ------------------------------------------------------------
    function Na__LeHatch__ClampScale(pattern, value) {
        const min = pattern ? pattern.Pattern__MinScale : 0.25;
        const max = pattern ? pattern.Pattern__MaxScale : 4;
        const num = Number(value);
        if (!Number.isFinite(num)) return pattern ? pattern.Pattern__Scale : 1;
        return Math.min(max, Math.max(min, Math.round(num * 100) / 100));
    }

    function Na__LeHatch__ClampRotation(value) {
        const num = Number(value);
        if (!Number.isFinite(num)) return 0;
        return ((Math.round(num) % 360) + 360) % 360;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Use's Own Line Weight: Points to Keep, or null for "the Pattern's Standard"
    // ------------------------------------------------------------
    // null is a real answer, not a failure: it is what an emptied box, a record
    // from before the control existed and a reset all mean. Anything that is
    // not a positive number is null, so a typo can never store a weight of 0
    // and make a hatch vanish.
    // ------------------------------------------------------------
    function Na__LeHatch__ClampStrokePt(value) {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) return null;
        return Math.min(Na__LeHatch__MAX_STROKE_PT, Math.max(Na__LeHatch__MIN_STROKE_PT, Math.round(num * 100) / 100));
    }
    // ------------------------------------------------------------


    // FUNCTION | A Use's Own Line Colour: a Hex to Keep, or null for "the Pattern's Standard"
    // ------------------------------------------------------------
    function Na__LeHatch__CleanColour(value) {
        return /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? String(value) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Weight a Pattern Draws at When Nobody Has Set One, in Points
    // ------------------------------------------------------------
    // What a panel shows in the line weight box until a weight is typed. The
    // pattern's own Defaults__StrokeMm GROWS WITH THE PATTERN SCALE - a tile
    // drawn twice the size has lines twice as heavy, as it always has - so the
    // standard is quoted at the scale in use. A typed weight does not grow:
    // that is the point of typing one.
    // ------------------------------------------------------------
    function Na__LeHatch__StandardStrokePt(pattern, scale) {
        if (!pattern) return null;
        const mm = pattern.Pattern__StrokeMm * Na__LeHatch__ClampScale(pattern, scale);
        return Math.round((mm / Na__LeHatch__PT_TO_MM) * 100) / 100;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Colour a Pattern Draws in When Nobody Has Set One
    // ------------------------------------------------------------
    // The pattern's own ink when its file names one (grass is green whatever
    // it is drawn on), else the colour of whatever carries it: a vector's edge
    // colour, a site plan layer's line colour. ONE RULE FOR BOTH, so a pattern
    // reads the same on a drawn shape as on the site plan beside it.
    // ------------------------------------------------------------
    function Na__LeHatch__StandardColour(pattern, carrierColour) {
        return (pattern && pattern.Pattern__Ink) || carrierColour || '#000000';
    }
    // ------------------------------------------------------------


    // FUNCTION | A Viewport's Per-Category Pattern Settings
    // ------------------------------------------------------------
    // Returns { Hatch__PatternKey, Hatch__Scale, Hatch__RotationDeg } with the
    // layer's own default filled in for anything the viewport has not overridden.
    // A stored pattern key of '' means "no hatch on this layer", which is
    // different from "not set" - so it is kept, not dropped.
    // ------------------------------------------------------------
    function Na__LeHatch__Effective(viewport, categoryKey, defaultPatternKey) {
        const block  = viewport ? viewport[Na__LeHatch__FIELD] : null;
        const cats   = (block && typeof block === 'object') ? block[Na__LeHatch__CAT_FIELD] : null;
        const stored = (cats && typeof cats === 'object') ? cats[categoryKey] : null;

        const key = (stored && typeof stored.Hatch__PatternKey === 'string')
            ? stored.Hatch__PatternKey
            : (defaultPatternKey || '');

        const pattern = key ? Na__LeHatch__Get(key) : null;
        return {
            Hatch__PatternKey : key,
            Hatch__Pattern    : pattern,
            Hatch__Scale      : Na__LeHatch__ClampScale(pattern, stored ? stored.Hatch__Scale : undefined),
            Hatch__RotationDeg: Na__LeHatch__ClampRotation(stored ? stored.Hatch__RotationDeg : (pattern ? pattern.Pattern__RotationDeg : 0)),
            // THE WASH IS A SEPARATE DECK FROM THE HATCH, so it gets a switch of
            // its own rather than an entry in the pattern list. Adam: 'add a "do
            // not fill" option here as well, so you can selectively turn off the
            // fill if you don't want it on certain elements.' Kept apart because
            // the two compose: a hatch over bare paper is an ordinary drafting
            // look, and folding both into one dropdown would make it unreachable.
            // Absent means ON, so no saved viewport changes.
            Hatch__Filled     : (stored && stored.Hatch__Filled === false) ? false : true,
            // THIS LAYER'S OWN LINE WEIGHT AND LINE COLOUR ON THIS VIEWPORT, or
            // null for the pattern's standard - which is what every viewport
            // saved before the two controls existed reads as.
            Hatch__StrokePt   : Na__LeHatch__ClampStrokePt(stored ? stored.Hatch__StrokePt : null),
            Hatch__Colour     : Na__LeHatch__CleanColour(stored ? stored.Hatch__Colour : null)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Viewport's Hatch Overrides Amount To, as One String
    // ------------------------------------------------------------
    // THE REPAINT GUARD READS THIS. A site plan frame keeps the key its picture
    // was painted from and skips the repaint when the key has not moved, so
    // anything that changes the picture has to be IN the key or the change is
    // written to the record and never drawn.
    //
    // That was the bug behind the Patterns panel: typing a scale saved it, the
    // sheet announced the change, the frame compared its key, found it the same
    // and only resized the SVG it already had. The pattern moved on the next
    // full reload and not before. Adam: 'you should enter a value, hit Enter,
    // and then it should regenerate that particular pattern in the selected
    // viewport.'
    //
    // Sorted by category key, so the string depends on the settings and not on
    // the order the panel happened to write them in - otherwise editing two
    // layers and coming back to the first would repaint for no reason.
    // ------------------------------------------------------------
    function Na__LeHatch__Token(viewport) {
        const block = viewport ? viewport[Na__LeHatch__FIELD] : null;
        const cats  = (block && typeof block === 'object') ? block[Na__LeHatch__CAT_FIELD] : null;
        if (!cats || typeof cats !== 'object') return 'hatch:none';
        return 'hatch:' + Object.keys(cats).sort().map((key) => {
            const entry = cats[key] || {};
            return key + '=' + (entry.Hatch__PatternKey === undefined ? '' : entry.Hatch__PatternKey)
                 + ',' + (Number.isFinite(entry.Hatch__Scale)       ? entry.Hatch__Scale       : '')
                 + ',' + (Number.isFinite(entry.Hatch__RotationDeg) ? entry.Hatch__RotationDeg : '')
                 + ',' + (entry.Hatch__Filled === false ? '0' : '1')
                 + ',' + (Number.isFinite(entry.Hatch__StrokePt) ? entry.Hatch__StrokePt : '')   // <-- A typed line weight and a picked colour change the picture too
                 + ',' + (typeof entry.Hatch__Colour === 'string' ? entry.Hatch__Colour : '');
        }).join('|');
    }
    // ------------------------------------------------------------


// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | XML-Safe Attribute Text
    // ------------------------------------------------------------
    function Na__LeHatch__Esc(value) {
        return String(value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    // ------------------------------------------------------------


    // FUNCTION | One <pattern> Definition, Ready for the Sheet's <defs>
    // ------------------------------------------------------------
    // THE UNITS. The site plan viewport's SVG is measured in DRAWING millimetres,
    // so a paper millimetre is `denominator` drawing millimetres. Every length is
    // multiplied by D x scale, exactly as the linework's stroke widths and dash
    // patterns already are. The pattern therefore prints the same size on paper
    // whatever the drawing scale.
    //
    // patternTransform carries the rotation, so the browser turns the whole tiled
    // field rather than each glyph - which is what rotating a hatch means.
    //
    // `id` must be unique across the whole sheet: two site plan viewports on one
    // sheet would otherwise share one definition and the second would take the
    // first's transform.
    //
    // options.strokePt is this USE's own line weight in printed points, or
    // nothing for the pattern's standard. The standard (Pattern__StrokeMm) is a
    // tile length and so grows with the scale, as it always has; a typed weight
    // is a PAPER length and must not, so it is divided by the scale here and
    // the group's scaling then puts it back to exactly what was typed.
    // ------------------------------------------------------------
    function Na__LeHatch__PatternDef(id, pattern, options) {
        if (!pattern) return '';
        const opts   = options || {};
        const D      = Number.isFinite(opts.denominator) ? opts.denominator : 1;
        const scale  = Na__LeHatch__ClampScale(pattern, opts.scale);
        const rot    = Na__LeHatch__ClampRotation(opts.rotationDeg);
        const colour = (opts.colour && typeof opts.colour === 'string') ? opts.colour : '#000000';
        const unit   = D * scale;                                               // <-- One paper millimetre, in drawing millimetres

        const tileW = pattern.Pattern__TileWidthMm  * unit;
        const tileH = pattern.Pattern__TileHeightMm * unit;
        const ownPt  = Na__LeHatch__ClampStrokePt(opts.strokePt);
        const stroke = (ownPt === null) ? pattern.Pattern__StrokeMm * unit : ownPt * Na__LeHatch__PT_TO_MM * D;

        // A tile's own mark is written exactly as its file places it. A copy is
        // that place moved by whole tiles, tidied to a ten-thousandth so 10.4 - 11
        // is written -0.6 and not the -0.5999999999999996 the arithmetic gives.
        const moved = (at, tiles, size) => (tiles === 0 ? at : Math.round((at + (tiles * size)) * 10000) / 10000);
        const path = (mark, dx, dy) => {
            const fill = (mark.Mark__Glyph.Glyph__Fill === Na__LeHatch__INHERIT) ? colour : mark.Mark__Glyph.Glyph__Fill;
            return `<path d="${Na__LeHatch__Esc(mark.Mark__Glyph.Glyph__Path)}"`
                 + ` transform="translate(${moved(mark.Mark__XMm, dx, pattern.Pattern__TileWidthMm)} ${moved(mark.Mark__YMm, dy, pattern.Pattern__TileHeightMm)})"`
                 + ` fill="${Na__LeHatch__Esc(fill)}"/>`;
        };
        // THE TILE'S OWN MARKS, THEN WHAT THE NEIGHBOURING TILES PUSH INTO IT.
        // See SeamCopies: nothing is added for a mark that stays inside its tile.
        const body = pattern.Pattern__Marks.map((mark) => path(mark, 0, 0)).join('')
                   + Na__LeHatch__SeamCopies(pattern, stroke / unit).map((copy) => path(copy.mark, copy.dx, copy.dy)).join('');

        // The glyph paths are authored in TILE millimetres, so the group is
        // scaled by `unit` rather than every number being multiplied by hand.
        // stroke-width is divided back out so the line keeps its true paper
        // weight through that scaling.
        return `<pattern id="${Na__LeHatch__Esc(id)}" patternUnits="userSpaceOnUse"`
             + ` width="${tileW}" height="${tileH}"`
             + (rot ? ` patternTransform="rotate(${rot})"` : '')
             + `><g transform="scale(${unit})" fill="none"`
             + ` stroke="${Na__LeHatch__Esc(colour)}" stroke-width="${stroke / unit}"`
             + ` stroke-linecap="round" stroke-linejoin="round"`
             + ` opacity="${pattern.Pattern__Opacity}">${body}</g></pattern>`;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Each Mark's Centreline Box in Tile Millimetres (cached on the pattern)
    // ------------------------------------------------------------
    // null for a mark whose glyph cannot be flattened; it simply gets no seam
    // copy, which is what it got before seam copies existed.
    // ------------------------------------------------------------
    function Na__LeHatch__MarkBoxes(pattern) {
        if (pattern.Pattern__BoxCache) return pattern.Pattern__BoxCache;
        pattern.Pattern__BoxCache = pattern.Pattern__Marks.map((mark) => {
            const flat = Na__LeHatch__FlattenPath(mark.Mark__Glyph.Glyph__Path);
            if (!flat || flat.length === 0) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            flat.forEach((line) => line.points.forEach((point) => {
                if (point[0] < minX) minX = point[0]; if (point[0] > maxX) maxX = point[0];
                if (point[1] < minY) minY = point[1]; if (point[1] > maxY) maxY = point[1];
            }));
            if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
            return { minX : minX + mark.Mark__XMm, maxX : maxX + mark.Mark__XMm, minY : minY + mark.Mark__YMm, maxY : maxY + mark.Mark__YMm };
        });
        return pattern.Pattern__BoxCache;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Neighbouring Tiles' Marks That Reach Into This Tile
    // ------------------------------------------------------------
    // WHY. A browser clips a <pattern>'s content at the tile edge; the PDF
    // stamper clips nothing. So whatever crosses a seam is whole on paper and
    // cut on screen - unless the tile ALSO draws the part of its neighbours'
    // marks that lands inside it, which is all this works out. For a line
    // meeting a seam at an angle that is a sliver along one edge of the line at
    // every crossing, growing with the line's weight; for a line through a
    // tile's corner it is a bite out of both sides.
    //
    // Returns [{ mark, dx, dy }]: draw `mark` again, moved dx tiles across and
    // dy tiles down. A mark is copied from a neighbour only when its ink - the
    // centreline box grown by half the line weight, for the round caps and
    // joins - overlaps this tile from there. A mark whose ink is wholly inside
    // its own tile overlaps from nowhere and gets nothing added, so a pattern
    // that never touched a seam is written byte for byte as it was.
    //
    // A COPY SOMEBODY ALREADY PLACED BY HAND IS NOT MADE AGAIN. The woodland's
    // conifer and the pond's ripple each carry a knit copy one tile away, from
    // before this existed. Drawing a second one exactly over it would change
    // nothing but the anti-aliasing - the doubled edge pixels read a touch
    // bolder than every other mark in the field - so it is skipped.
    //
    // strokeTileMm is the line weight in TILE millimetres, because a typed
    // weight changes how far a line's ink reaches.
    // ------------------------------------------------------------
    function Na__LeHatch__SeamCopies(pattern, strokeTileMm) {
        const W = pattern.Pattern__TileWidthMm, H = pattern.Pattern__TileHeightMm;
        const reach = (Number.isFinite(strokeTileMm) && strokeTileMm > 0 ? strokeTileMm / 2 : 0) + 0.01;
        const boxes = Na__LeHatch__MarkBoxes(pattern);
        const placedByHand = (mark, x, y) => pattern.Pattern__Marks.some((other) => other !== mark
            && other.Mark__Glyph === mark.Mark__Glyph
            && Math.abs(other.Mark__XMm - x) < 1e-6 && Math.abs(other.Mark__YMm - y) < 1e-6);
        const copies = [];
        pattern.Pattern__Marks.forEach((mark, index) => {
            const box = boxes[index];
            if (!box) return;
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const overlapsX = (box.maxX + reach + (dx * W)) > 0 && (box.minX - reach + (dx * W)) < W;
                    const overlapsY = (box.maxY + reach + (dy * H)) > 0 && (box.minY - reach + (dy * H)) < H;
                    if (!overlapsX || !overlapsY) continue;
                    if (placedByHand(mark, mark.Mark__XMm + (dx * W), mark.Mark__YMm + (dy * H))) continue;
                    copies.push({ mark : mark, dx : dx, dy : dy });
                }
            }
        });
        return copies;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Flatten One Glyph Path to Polylines in Tile Millimetres
    // ------------------------------------------------------------
    // THE PDF CANNOT USE THE <pattern>. jsPDF has no tiling pattern primitive,
    // so the paper copy has to stamp the tile itself - which means the glyph
    // paths, authored as ordinary SVG, have to become plain point lists first.
    //
    // M, L, H, V, C, S and Z, absolute or relative, which is everything the
    // library's glyphs use and everything a hand-authored one reasonably would.
    // A command outside that set makes the whole glyph return null rather than
    // half a tree: a warning and a missing symbol is honest, a mangled one is
    // not.
    // ------------------------------------------------------------
    function Na__LeHatch__FlattenPath(d) {
        const tokens = String(d || '').match(/[MmLlHhVvCcSsZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
        if (!tokens || tokens.length === 0) return null;

        const lines = [];
        let current = null;
        let x = 0, y = 0, startX = 0, startY = 0;
        let lastC2X = null, lastC2Y = null;                                      // <-- S mirrors the previous curve's second control point
        let command = null;
        let at = 0;

        const number = () => parseFloat(tokens[at++]);
        const open   = () => { current = { points : [[x, y]], closed : false }; lines.push(current); };
        const push   = () => { if (current) current.points.push([x, y]); };
        const curve  = (c1x, c1y, c2x, c2y, ex, ey) => {
            // 12 steps holds a 3 mm glyph well inside a printer's own dot; the
            // tile is stamped hundreds of times, so this is the one place where
            // being generous with points is expensive.
            const x0 = x, y0 = y;
            for (let i = 1; i <= 12; i++) {
                const t = i / 12, u = 1 - t;
                const px = (u * u * u * x0) + (3 * u * u * t * c1x) + (3 * u * t * t * c2x) + (t * t * t * ex);
                const py = (u * u * u * y0) + (3 * u * u * t * c1y) + (3 * u * t * t * c2y) + (t * t * t * ey);
                if (current) current.points.push([px, py]);
            }
            x = ex; y = ey; lastC2X = c2x; lastC2Y = c2y;
        };

        while (at < tokens.length) {
            if (/[MmLlHhVvCcSsZz]/.test(tokens[at])) { command = tokens[at++]; }
            else if (command === 'M') { command = 'L'; }                          // <-- Repeated pairs after an M are an implicit lineto
            else if (command === 'm') { command = 'l'; }
            if (!command) return null;
            const rel = command === command.toLowerCase();
            const ox  = rel ? x : 0;
            const oy  = rel ? y : 0;

            switch (command.toUpperCase()) {
                case 'M': x = ox + number(); y = oy + number(); startX = x; startY = y; open(); lastC2X = null; break;
                case 'L': x = ox + number(); y = oy + number(); push(); lastC2X = null; break;
                case 'H': x = ox + number();                    push(); lastC2X = null; break;
                case 'V': y = oy + number();                    push(); lastC2X = null; break;
                case 'C': {
                    const c1x = ox + number(), c1y = oy + number();
                    const c2x = ox + number(), c2y = oy + number();
                    curve(c1x, c1y, c2x, c2y, ox + number(), oy + number());
                    break;
                }
                case 'S': {
                    const smooth = lastC2X !== null;                          // <-- One test for both: they are set and cleared together
                    const c1x = smooth ? (2 * x) - lastC2X : x;
                    const c1y = smooth ? (2 * y) - lastC2Y : y;
                    const c2x = ox + number(), c2y = oy + number();
                    curve(c1x, c1y, c2x, c2y, ox + number(), oy + number());
                    break;
                }
                case 'Z':
                    if (current) { current.closed = true; current.points.push([startX, startY]); }
                    x = startX; y = startY; current = null; lastC2X = null;
                    break;
                default:
                    console.warn('[TrueVision3D LayoutEditor] Hatch glyph uses an unsupported path command (' + command + ') - it will not print.');
                    return null;
            }
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        }
        return lines.filter((line) => line.points.length > 1);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Tile as Plain Polylines, for a Renderer With No Pattern Primitive
    // ------------------------------------------------------------
    // Returns { tileWidthMm, tileHeightMm, strokeMm, opacity, lines : [ [ [x,y],
    // ... ] ] } in TILE millimetres, every placement already offset into place,
    // so a caller only has to step the tile across an area and draw.
    //
    // Cached on the pattern object: a PDF stamps one tile hundreds of times and
    // the flattening does not change between them.
    // ------------------------------------------------------------
    function Na__LeHatch__TilePolylines(pattern) {
        if (!pattern) return null;
        if (pattern.Pattern__FlatCache) return pattern.Pattern__FlatCache;
        const lines = [];
        pattern.Pattern__Marks.forEach((mark) => {
            const flat = Na__LeHatch__FlattenPath(mark.Mark__Glyph.Glyph__Path);
            if (!flat) return;
            flat.forEach((line) => {
                lines.push(line.points.map((point) => [ point[0] + mark.Mark__XMm, point[1] + mark.Mark__YMm ]));
            });
        });
        pattern.Pattern__FlatCache = {
            tileWidthMm  : pattern.Pattern__TileWidthMm,
            tileHeightMm : pattern.Pattern__TileHeightMm,
            strokeMm     : pattern.Pattern__StrokeMm,
            opacity      : pattern.Pattern__Opacity,
            lines        : lines
        };
        return pattern.Pattern__FlatCache;
    }
    // ------------------------------------------------------------


    // MODULE VARIABLE | Unique Ids for Pattern Definitions
    // ------------------------------------------------------------
    // One document can hold many hatched shapes and more than one site plan
    // viewport. Two <pattern> elements sharing an id means the FIRST one wins
    // for every user of it, so the second shape silently takes the first's
    // scale and rotation - which looks like the panel being ignored.
    // ------------------------------------------------------------
    // A hatched field is one jsPDF line call per glyph segment, so a big area at
    // a fine scale can run to millions of them. Past this the area is left bare
    // WITH A WARNING, rather than an export that hangs with nothing on screen to
    // say why.
    const Na__LeHatch__TILE_CAP = 20000;

    // HELPER FUNCTION | A Hex Colour as PDF Channels
    // ------------------------------------------------------------
    function Na__LeHatch__Rgb(hex) {
        const value = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || '')) ? String(hex).replace('#', '') : '323232';
        return [ parseInt(value.substring(0, 2), 16), parseInt(value.substring(2, 4), 16), parseInt(value.substring(4, 6), 16) ];
    }
    // ------------------------------------------------------------

    let Na__LeHatch__IdCounter = 0;
    // ------------------------------------------------------------


    // FUNCTION | A <defs> Block and a Paint Reference, for an SVG Painter
    // ------------------------------------------------------------
    // The counterpart of the gradient tool's SVG paint, and used the same way:
    // the caller writes `defs` into its markup and fills a path with `fill`.
    //
    // options: { pattern, scale, rotationDeg, colour, strokePt, denominator }.
    // Omit the denominator for paper-millimetre space - the sheet's own markup
    // layer - where a tile millimetre IS a paper millimetre. A site plan
    // viewport draws in DRAWING millimetres and passes its scale denominator,
    // so a tile keeps its paper size at every scale. strokePt is the use's own
    // line weight in printed points; leave it out for the pattern's standard.
    // ------------------------------------------------------------
    function Na__LeHatch__SvgPaint(options) {
        const opts = options || {};
        if (!opts.pattern) return null;
        const id = 'naLeHatch' + (++Na__LeHatch__IdCounter);
        const def = Na__LeHatch__PatternDef(id, opts.pattern, {
            denominator : Number.isFinite(opts.denominator) ? opts.denominator : 1,
            scale       : opts.scale,
            rotationDeg : opts.rotationDeg,
            colour      : opts.colour,
            strokePt    : opts.strokePt
        });
        return def ? { defs : '<defs>' + def + '</defs>', fill : 'url(#' + id + ')' } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stamp a Tile Across One Closed Polygon, Clipped to It
    // ------------------------------------------------------------
    // The counterpart of the gradient tool's PDF paint. jsPDF has no tiling
    // pattern, so the tile is stamped by hand: clipped to the polygon, stepped
    // across its bounding box, and rotated about the origin exactly as
    // patternTransform="rotate(r)" rotates the SVG's field - so screen and paper
    // agree glyph for glyph rather than merely looking similar.
    //
    // `points` are [x, y] pairs in the PDF's own paper millimetres. options are
    // SvgPaint's, without denominator: the caller converts to paper first, so a
    // tile millimetre is a paper millimetre here by construction. strokePt and
    // colour are the use's own, exactly as SvgPaint takes them, so a hatch
    // prints at the weight and in the colour it shows.
    //
    // Returns false and leaves the area bare if it cannot clip - an unclipped
    // hatch would flood the sheet - or if the area needs more tiles than the cap.
    // ------------------------------------------------------------
    function Na__LeHatch__DrawPdf(doc, points, options) {
        const opts = options || {};
        const tile = Na__LeHatch__TilePolylines(opts.pattern);
        if (!doc || !tile || tile.lines.length === 0 || !points || points.length < 3) return false;

        const step = Na__LeHatch__ClampScale(opts.pattern, opts.scale);
        const tw   = tile.tileWidthMm  * step;
        const th   = tile.tileHeightMm * step;
        if (!(tw > 0) || !(th > 0)) return false;
        const rad = (Na__LeHatch__ClampRotation(opts.rotationDeg) * Math.PI) / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const rgb = Na__LeHatch__Rgb(opts.colour);

        let clipped = false;
        try {
            doc.saveGraphicsState();
            doc.moveTo(points[0][0], points[0][1]);
            for (let i = 1; i < points.length; i++) doc.lineTo(points[i][0], points[i][1]);
            doc.clip();
            doc.discardPath();
            clipped = true;
        } catch (error) {
            if (clipped) { try { doc.restoreGraphicsState(); } catch (e) { /* nothing */ } }
            return false;
        }

        try {
            // The bounding box the tiles must cover, taken back through the
            // rotation so the un-rotated grid is stepped over the region that
            // lands on the polygon once it is turned.
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            points.forEach((point) => {
                const ux = (point[0] * cos) + (point[1] * sin);                 // <-- R(-r) . p
                const uy = (-point[0] * sin) + (point[1] * cos);
                if (ux < minX) minX = ux; if (ux > maxX) maxX = ux;
                if (uy < minY) minY = uy; if (uy > maxY) maxY = uy;
            });
            if (!Number.isFinite(minX) || !Number.isFinite(minY)) return false;

            const fromX = Math.floor(minX / tw) * tw;
            const fromY = Math.floor(minY / th) * th;
            const cols  = Math.ceil((maxX - fromX) / tw) + 1;
            const rows  = Math.ceil((maxY - fromY) / th) + 1;
            if (cols * rows > Na__LeHatch__TILE_CAP) {
                console.warn('[TrueVision3D LayoutEditor] A hatched area needs ' + (cols * rows) + ' tiles, over the ' + Na__LeHatch__TILE_CAP + ' cap - it is left unhatched in the PDF.');
                return false;
            }

            // A TYPED WEIGHT IS A PAPER WEIGHT and is set as it stands; the
            // pattern's standard is a tile length and grows with the scale -
            // the same two cases, in the same order, as PatternDef's.
            const ownPt = Na__LeHatch__ClampStrokePt(opts.strokePt);
            doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
            doc.setLineWidth(ownPt === null ? tile.strokeMm * step : ownPt * Na__LeHatch__PT_TO_MM);
            doc.setLineCap('round');
            doc.setLineJoin('round');
            try { doc.setLineDashPattern([], 0); } catch (e) { /* older build */ }
            const gs = (typeof doc.GState === 'function' && tile.opacity < 1) ? doc.GState({ opacity : tile.opacity }) : null;
            if (gs) doc.setGState(gs);

            for (let c = 0; c < cols; c++) {
                for (let r = 0; r < rows; r++) {
                    const ox = fromX + (c * tw);
                    const oy = fromY + (r * th);
                    tile.lines.forEach((line) => {
                        for (let i = 1; i < line.length; i++) {
                            const ax = ox + (line[i - 1][0] * step), ay = oy + (line[i - 1][1] * step);
                            const bx = ox + (line[i][0]     * step), by = oy + (line[i][1]     * step);
                            doc.line((ax * cos) - (ay * sin), (ax * sin) + (ay * cos),
                                     (bx * cos) - (by * sin), (bx * sin) + (by * cos));
                        }
                    });
                }
            }
            if (gs && typeof doc.GState === 'function') doc.setGState(doc.GState({ opacity : 1 }));
            return true;
        } finally {
            try { doc.restoreGraphicsState(); } catch (e) { /* nothing */ }
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | A Standalone Swatch, for a Panel Tile
    // ------------------------------------------------------------
    // Its own <svg> with its own <defs>, so a tile is self-contained markup that
    // can be dropped straight into a panel without touching the sheet.
    // ------------------------------------------------------------
    function Na__LeHatch__SwatchMarkup(pattern, widthPx, heightPx, colour) {
        if (!pattern) return '';
        const id  = 'na-le-hatch-swatch-' + Na__LeHatch__Esc(pattern.Pattern__Key);
        const ink = pattern.Pattern__Ink || colour || '#43A047';                   // <-- A pattern with its own ink shows in it
        // 3 makes a tile read at tile size on a small chip without the glyphs
        // shrinking to nothing.
        const def = Na__LeHatch__PatternDef(id, pattern, { denominator : 3, scale : 1, rotationDeg : 0, colour : ink });
        return `<svg width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}" aria-hidden="true">`
             + `<defs>${def}</defs>`
             + `<rect width="${widthPx}" height="${heightPx}" fill="url(#${id})"/></svg>`;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Hatch Pattern API
    // ------------------------------------------------------------
    export {
        Na__LeHatch__FIELD,
        Na__LeHatch__CAT_FIELD,
        Na__LeHatch__INHERIT,
        Na__LeHatch__Ready,
        Na__LeHatch__IsLoaded,
        Na__LeHatch__GetPacks,
        Na__LeHatch__Get,
        Na__LeHatch__ClampScale,
        Na__LeHatch__ClampRotation,
        Na__LeHatch__ClampStrokePt,
        Na__LeHatch__CleanColour,
        Na__LeHatch__StandardStrokePt,
        Na__LeHatch__StandardColour,
        Na__LeHatch__Effective,
        Na__LeHatch__Token,
        Na__LeHatch__PatternDef,
        Na__LeHatch__TilePolylines,
        Na__LeHatch__SvgPaint,
        Na__LeHatch__DrawPdf,
        Na__LeHatch__SwatchMarkup
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
