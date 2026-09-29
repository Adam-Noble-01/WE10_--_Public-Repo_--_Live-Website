// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PARAMETRIC SCRAPBOOK - SITE PLAN LEGEND
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookParametric__SiteLegend__.js
// NAMESPACE  : Na__LeParamLegend
// MODULE     : Layout Editor - Parametric Scrapbook - Site Plan Legend
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The quick-reference legend a site plan carries - one row per wash, hatch and line the sheet's site plans actually show, each with a swatch drawn exactly as the drawing draws it
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHAT IS LISTED IS A PARAMETER, and that is the whole design, as it is for
//   the Area Schedule. This module is PURE - parameters in, records out - so
//   the sheet's site plans reach it as `Data`, filled by
//   Na__LayoutEditor__ScrapbookParametric__SiteLegendLink__ from the very
//   build the site plan painter paints. It draws under Node, in a tile preview
//   and in a drag ghost, and the stored block says exactly what the paper says.
// - TWO KINDS OF ROW. An AREA row is a layer whose wash or hatch shows: its
//   swatch is a box washed in the layer's fill, carrying the hatch's own
//   glyphs, edged in the layer's line. A LINE row is a layer drawn as lines
//   alone - the red line boundary, a fence to be removed: its swatch is a
//   short run of that line.
// - THE GLYPHS ARE DRAWN, NOT TILED. A hatch on a sheet vector is anchored to
//   the sheet's corner, so a small swatch would show whatever part of the tile
//   happened to land on it - often nothing at all, on grass whose tile is 28 x
//   26 mm with ten tufts in it - and would change every time the legend was
//   moved. Instead the densest swatch-sized window of the pattern is found
//   once, and its whole glyphs are written as ordinary vectors, at the size,
//   turn, weight and ink the drawing uses. `tools.hatchTile` hands over the
//   pattern's marks; with no tools (Node, a failed library) the swatch is the
//   wash and the edge alone.
// - DASHES AND DOTS ARE SHAPES, NOT A DASH PATTERN. The site plan paints its
//   lines with ROUND caps, so a 0.2 mm "dot" prints as a round dot a line
//   width across. A sheet vector's own dash pattern is drawn with butt caps
//   on screen and on paper, which would turn those dots into slivers. Each
//   dash is therefore a filled capsule - the dash's length plus a half width
//   of round end at each side, exactly what a round cap draws - so the swatch
//   matches the drawing on screen and in the PDF alike.
// - IT IS SET TO ITS WORDS. Each column is as wide as its longest label
//   needs, measured through `tools.measureTextMm`; WidthMm is a MINIMUM, so a
//   legend can be lined up with a title block and never crowds its own text.
//   A legend drawn to the chrome's estimate before the fonts loaded is caught
//   by `refit`, as a drawing title is.
// - THE ORIGIN IS THE LEFT END OF THE TOP RULE, with the title above it and
//   the rows below - the Drawing Title's and the Area Schedule's idiom.
// - EVERY SHAPE FIRST, THEN EVERY TEXT, each in a fixed order, so the engine
//   updates the element in place slot for slot.
//
// INTEGRATION:
// - Registered by Na__LayoutEditor__Panel__ScrapbookParametric__ with a reader
//   for the config's SiteLegend block.
// - PURE: no DOM, no editor modules, no imports at all. Whatever it cannot
//   reach arrives in `tools` (the text measurer and the hatch marks).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (29-Sep-2026)
// - ValeVision    : not ported - ValeVision has no site plan drawings.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation: area and line rows, the swatch (wash, drawn
//   glyphs, edge), capsule dashes, columns set to their words, the hidden
//   rows, the lookup menu and the refit.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Type, Its Row Kinds and What a Rebuild Keeps
    // ------------------------------------------------------------
    const Na__LeParamLegend__TYPE      = 'SiteLegend';
    const Na__LeParamLegend__KIND_AREA = 'area';                                // <-- A wash or a hatch shows: the swatch is a box
    const Na__LeParamLegend__KIND_LINE = 'line';                                // <-- Lines alone: the swatch is a short run of the line
    const Na__LeParamLegend__KEEP      = Object.freeze([ 'TitleText', 'Columns', 'ShowLines', 'Hidden', 'ViewportId', 'WidthMm', 'TextSizeMm', 'SwatchWidthMm', 'SwatchHeightMm', 'Data' ]);
    const Na__LeParamLegend__MAX_ROWS    = 80;                                  // <-- A site plan with more layers than this has a problem a legend cannot fix
    const Na__LeParamLegend__MAX_HIDDEN  = 200;
    const Na__LeParamLegend__MAX_PIECES  = 240;                                 // <-- Capsules in one run: a dash pattern typed tiny cannot flood the sheet
    const Na__LeParamLegend__MAX_TILES   = 400;                                 // <-- Tiles searched for a swatch's glyphs
    const Na__LeParamLegend__MM_TO_PT    = 72 / 25.4;
    const Na__LeParamLegend__FIT_SLACK_MM = 0.05;                               // <-- A rule this close to where its words say it should end is left alone
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What Every Value Falls Back To
    // ------------------------------------------------------------
    // Mirrors the shipped config block, so a config that could not be read
    // still draws the shipped legend rather than nothing.
    // ------------------------------------------------------------
    const Na__LeParamLegend__FALLBACK = Object.freeze({
        WidthMm           : 60,
        WidthMaxMm        : 420,
        WidthStepMm       : 2,
        Columns           : 0,                                                   // <-- 0 is automatic: another column every AutoRowsPerColumn rows
        ColumnsMax        : 4,
        AutoRowsPerColumn : 12,
        ColumnGapMm       : 6,

        TextSizeMm        : 2.2,
        TextWeight        : 400,
        TextColour        : '#172b3a',
        MutedColour       : '#5f6b74',
        CharWidthRatio    : 0.55,

        TitleSizeMm       : 3.2,
        TitleWeight       : 600,
        TitleColour       : '#172b3a',
        TitleAboveRuleMm  : 1.8,

        RulePt            : 0.4,
        RuleColour        : '#172b3a',

        FirstRowGapMm     : 2.0,
        RowGapMm          : 1.6,

        SwatchWidthMm     : 12,
        SwatchHeightMm    : 6,
        SwatchTextGapMm   : 2.4,
        GlyphInsetMm      : 0.35,
        GlyphSearchStepMm : 0.5,
        GlyphMax          : 16,

        Heading           : 'Legend',
        EmptyLabel        : 'No washes, hatches or lines found on this sheet\'s site plans',
        ShowLines         : true,
        HiddenByDefault   : Object.freeze([
            'TrueVision__SitePlan__Contours',
            'TrueVision__SitePlan__OsMapping',
            'TrueVision__SitePlan__OsMappingMainRoads',
            'TrueVision__SitePlan__OsMappingMajorFeature',
            'TrueVision__SitePlan__OsMappingMinorStreets'
        ])
    });
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Glyph Windows Already Found
    // ------------------------------------------------------------
    // Finding a swatch's glyphs searches a few thousand windows; a legend is
    // rebuilt on every change of its settings, so each answer is kept. Keyed by
    // everything the answer depends on, and bounded.
    // ------------------------------------------------------------
    const Na__LeParamLegend__GlyphCache = new Map();
    const Na__LeParamLegend__GLYPH_CACHE_MAX = 64;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config Readers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Value of the SiteLegend Block, or Its Fallback
    // ------------------------------------------------------------
    function Na__LeParamLegend__Number(config, key) {
        const value = config ? config['SiteLegend__' + key] : undefined;
        return (typeof value === 'number' && Number.isFinite(value)) ? value : Na__LeParamLegend__FALLBACK[key];
    }
    function Na__LeParamLegend__Text(config, key) {
        const value = config ? config['SiteLegend__' + key] : undefined;
        return (typeof value === 'string') ? value : Na__LeParamLegend__FALLBACK[key];
    }
    function Na__LeParamLegend__Flag(config, key) {
        const value = config ? config['SiteLegend__' + key] : undefined;
        return (typeof value === 'boolean') ? value : Na__LeParamLegend__FALLBACK[key];
    }
    function Na__LeParamLegend__List(config, key) {
        const value = config ? config['SiteLegend__' + key] : undefined;
        const list  = Array.isArray(value) ? value.filter((entry) => typeof entry === 'string' && entry.trim() !== '') : null;
        return (list ? list : Na__LeParamLegend__FALLBACK[key]).slice();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Round, Clamp and Tidy
    // ------------------------------------------------------------
    function Na__LeParamLegend__Round(value, places) {
        const k = Math.pow(10, places);
        return Math.round(value * k) / k;
    }
    function Na__LeParamLegend__Clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }
    function Na__LeParamLegend__Words(value, max) {
        return (typeof value === 'string') ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
    }
    function Na__LeParamLegend__Hex(value) {
        const text = (typeof value === 'string') ? value.trim() : '';
        return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toUpperCase() : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Parameters
// -----------------------------------------------------------------------------

    // FUNCTION | The Standard Legend
    // ------------------------------------------------------------
    // No ScaleDenominator anywhere: a legend is type and swatches on paper,
    // and a site plan's hatches are paper-sized whatever its scale, so a
    // change of scale never touches one.
    // ------------------------------------------------------------
    function Na__LeParamLegend__Standard(config) {
        return {
            TitleText      : '',
            Columns        : Math.round(Na__LeParamLegend__Number(config, 'Columns')),
            ShowLines      : Na__LeParamLegend__Flag(config, 'ShowLines'),
            Hidden         : Na__LeParamLegend__List(config, 'HiddenByDefault'),
            ViewportId     : '',
            WidthMm        : Na__LeParamLegend__Number(config, 'WidthMm'),
            TextSizeMm     : Na__LeParamLegend__Number(config, 'TextSizeMm'),
            SwatchWidthMm  : Na__LeParamLegend__Number(config, 'SwatchWidthMm'),
            SwatchHeightMm : Na__LeParamLegend__Number(config, 'SwatchHeightMm'),
            Data           : { Rows : [], Sources : 0 }
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Dash Pattern Made Safe (paper millimetres; empty is solid)
    // ------------------------------------------------------------
    function Na__LeParamLegend__Dash(given) {
        const list = (Array.isArray(given) ? given : []).slice(0, 12).map((mm) => Number(mm));
        if (!list.length || !list.every((mm) => Number.isFinite(mm) && mm >= 0)) return [];
        if (list.reduce((sum, mm) => sum + mm, 0) <= 0.01) return [];
        return list.map((mm) => Na__LeParamLegend__Round(mm, 4));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Rows a Legend Was Given, Made Safe
    // ------------------------------------------------------------
    // The rows come from the sheet through the link module, so they are
    // trusted no further than any other stored value. Every row is written in
    // one fixed key order, which is what lets the link module compare what a
    // legend holds with what the sheet shows as one string.
    // ------------------------------------------------------------
    function Na__LeParamLegend__NormaliseData(given) {
        const data  = (given && typeof given === 'object' && !Array.isArray(given)) ? given : {};
        const words = Na__LeParamLegend__Words;
        const hex   = Na__LeParamLegend__Hex;
        const num   = (value, min, max, places) => (typeof value === 'number' && Number.isFinite(value)) ? Na__LeParamLegend__Round(Na__LeParamLegend__Clamp(value, min, max), places) : null;
        const seen  = new Set();
        const rows  = [];
        (Array.isArray(data.Rows) ? data.Rows : []).forEach((row) => {
            if (rows.length >= Na__LeParamLegend__MAX_ROWS || !row || typeof row !== 'object') return;
            const key = words(row.Key, 160);
            if (key === '' || seen.has(key)) return;
            let kind = row.Kind === Na__LeParamLegend__KIND_LINE ? Na__LeParamLegend__KIND_LINE : Na__LeParamLegend__KIND_AREA;
            const kept = { Key : key, Label : words(row.Label, 120) || key, Kind : kind };
            const fill  = (row.Fill  && typeof row.Fill  === 'object') ? row.Fill  : null;
            const hatch = (row.Hatch && typeof row.Hatch === 'object') ? row.Hatch : null;
            const line  = (row.Line  && typeof row.Line  === 'object') ? row.Line  : null;
            if (kind === Na__LeParamLegend__KIND_AREA && fill && hex(fill.Hex)) {
                const opacity = num(fill.Opacity, 0, 1, 3);
                kept.Fill = { Hex : hex(fill.Hex), Opacity : opacity === null ? 1 : opacity };
            }
            if (kind === Na__LeParamLegend__KIND_AREA && hatch && words(hatch.Key, 120) !== '') {
                const scale  = num(hatch.Scale, 0.01, 100, 4);
                const turn   = num(hatch.RotationDeg, -360, 360, 3);
                kept.Hatch = { Key : words(hatch.Key, 120), Scale : scale === null ? 1 : scale, RotationDeg : turn === null ? 0 : turn, Colour : hex(hatch.Colour) || '#000000' };
                const pt = num(hatch.StrokePt, 0.01, 20, 3);
                if (pt !== null && pt > 0) kept.Hatch.StrokePt = pt;
            }
            if (line && hex(line.Hex)) {
                const width = num(line.WidthMm, 0.01, 5, 4);
                if (width !== null) kept.Line = { Hex : hex(line.Hex), WidthMm : width, DashMm : Na__LeParamLegend__Dash(line.DashMm) };
            }
            // AN AREA WITH NOTHING TO WASH OR HATCH IS ITS LINE, and a line with
            // no line is nothing at all.
            if (kind === Na__LeParamLegend__KIND_AREA && !kept.Fill && !kept.Hatch) {
                if (!kept.Line) return;
                kind = kept.Kind = Na__LeParamLegend__KIND_LINE;
            }
            if (kind === Na__LeParamLegend__KIND_LINE && !kept.Line) return;
            seen.add(key);
            rows.push(kept);
        });
        const sources = (typeof data.Sources === 'number' && Number.isFinite(data.Sources)) ? Math.max(0, Math.min(99, Math.round(data.Sources))) : 0;
        return { Rows : rows, Sources : sources };
    }
    // ------------------------------------------------------------


    // FUNCTION | Parameters Made Whole and Held Inside Their Limits
    // ------------------------------------------------------------
    // HIDDEN IS KEPT WHOLE, NOT DEFAULTED PER KEY. An absent list is the
    // config's standard - the OS base map and the contours, which frame the
    // drawing rather than say anything a reader must look up - and a list that
    // is present, even empty, is somebody's decision and is left as it is.
    // ------------------------------------------------------------
    function Na__LeParamLegend__Normalise(config, params) {
        const given    = (params && typeof params === 'object') ? params : {};
        const standard = Na__LeParamLegend__Standard(config);
        const finite   = (value, fallback) => (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
        const most     = Math.max(1, Math.round(Na__LeParamLegend__Number(config, 'ColumnsMax')));
        const hidden   = Array.isArray(given.Hidden) ? given.Hidden : standard.Hidden;
        const kept     = [];
        hidden.forEach((key) => {
            const clean = Na__LeParamLegend__Words(key, 160);
            if (clean !== '' && kept.indexOf(clean) === -1 && kept.length < Na__LeParamLegend__MAX_HIDDEN) kept.push(clean);
        });
        return {
            TitleText      : Na__LeParamLegend__Words(given.TitleText, 120),
            Columns        : Math.round(Na__LeParamLegend__Clamp(finite(given.Columns, standard.Columns), 0, most)),   // <-- 0 is automatic
            ShowLines      : (typeof given.ShowLines === 'boolean') ? given.ShowLines : standard.ShowLines,
            Hidden         : kept,
            ViewportId     : Na__LeParamLegend__Words(given.ViewportId, 80),
            WidthMm        : Na__LeParamLegend__Round(Na__LeParamLegend__Clamp(finite(given.WidthMm, standard.WidthMm), 0, Math.max(10, Na__LeParamLegend__Number(config, 'WidthMaxMm'))), 1),
            TextSizeMm     : Na__LeParamLegend__Round(Na__LeParamLegend__Clamp(finite(given.TextSizeMm, standard.TextSizeMm), 0.8, 12), 2),
            SwatchWidthMm  : Na__LeParamLegend__Round(Na__LeParamLegend__Clamp(finite(given.SwatchWidthMm, standard.SwatchWidthMm), 2, 40), 1),
            SwatchHeightMm : Na__LeParamLegend__Round(Na__LeParamLegend__Clamp(finite(given.SwatchHeightMm, standard.SwatchHeightMm), 1.5, 30), 1),
            Data           : Na__LeParamLegend__NormaliseData(given.Data)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Rows the Legend Shows, in the Order It Shows Them
    // ------------------------------------------------------------
    // The link module has already ordered them - the top of the drawing first,
    // so the red line and the proposal lead and the base map comes last. Here
    // only what is switched off is taken away: a row somebody unticked, and
    // every line row while lines are off. An empty legend says so in words.
    // Returns [{ kind : 'area' | 'line' | 'empty', row }].
    // ------------------------------------------------------------
    function Na__LeParamLegend__Rows(config, whole) {
        const hidden = new Set(whole.Hidden);
        const shown  = whole.Data.Rows
            .filter((row) => !hidden.has(row.Key))
            .filter((row) => whole.ShowLines || row.Kind !== Na__LeParamLegend__KIND_LINE)
            .map((row) => ({ kind : row.Kind, row : row }));
        if (!shown.length) shown.push({ kind : 'empty', row : { Key : '', Label : Na__LeParamLegend__Text(config, 'EmptyLabel') } });
        return shown;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Measuring and Laying Out
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | How Wide a Line of Words Is on the Paper
    // ------------------------------------------------------------
    // The chrome's own measurer when there is one, so a column is as wide as
    // the paper prints its words; an average-width estimate otherwise (Node,
    // a tile before the fonts land), which refit replaces once they have.
    // ------------------------------------------------------------
    function Na__LeParamLegend__TextWidth(config, text, sizeMm, weight, tools) {
        const measure = (tools && typeof tools.measureTextMm === 'function') ? tools.measureTextMm : null;
        if (measure) {
            let width = 0;
            try { width = Number(measure(text, sizeMm, weight)); } catch (error) { width = 0; }
            if (Number.isFinite(width) && width > 0) return width;
        }
        return String(text || '').length * sizeMm * Na__LeParamLegend__Number(config, 'CharWidthRatio');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where Everything Goes
    // ------------------------------------------------------------
    // Rows run DOWN each column, then on to the next, as a reader scans a
    // list. Every column is as wide as its swatch, the gap and its widest
    // label; the legend is the columns and the gaps between them, the title,
    // or the minimum width, whichever is widest - and any width the minimum
    // adds is shared out between the columns, so their swatches stay in step.
    // ------------------------------------------------------------
    function Na__LeParamLegend__Layout(config, whole, rows, tools) {
        const sizeMm   = whole.TextSizeMm;
        const ratio    = sizeMm / Na__LeParamLegend__Number(config, 'TextSizeMm');
        const swatchW  = whole.SwatchWidthMm;
        const swatchH  = whole.SwatchHeightMm;
        const gap      = Na__LeParamLegend__Number(config, 'SwatchTextGapMm') * ratio;
        const colGap   = Na__LeParamLegend__Number(config, 'ColumnGapMm');
        const weight   = Na__LeParamLegend__Number(config, 'TextWeight');
        const titleMm  = Na__LeParamLegend__Number(config, 'TitleSizeMm') * ratio;
        const title    = whole.TitleText !== '' ? whole.TitleText : Na__LeParamLegend__Text(config, 'Heading');
        const cellH    = Math.max(swatchH, sizeMm * 1.2);
        const pitch    = cellH + (Na__LeParamLegend__Number(config, 'RowGapMm') * ratio);
        const firstGap = Na__LeParamLegend__Number(config, 'FirstRowGapMm') * ratio;

        const empty    = rows.length === 1 && rows[0].kind === 'empty';
        // AUTOMATIC COLUMNS: another one every AutoRowsPerColumn rows, so a
        // long legend lands as a few short columns rather than one strip down
        // the sheet. A number chosen by hand is kept whatever the rows do.
        const most     = Math.max(1, Math.round(Na__LeParamLegend__Number(config, 'ColumnsMax')));
        const wanted   = whole.Columns > 0 ? whole.Columns : Math.ceil(rows.length / Math.max(1, Math.round(Na__LeParamLegend__Number(config, 'AutoRowsPerColumn'))));
        const count    = Math.max(1, Math.min(wanted, most, rows.length));
        const perCol   = Math.ceil(rows.length / count);
        const columns  = [];
        for (let c = 0; c < count; c++) {
            const slice = rows.slice(c * perCol, (c + 1) * perCol);
            if (!slice.length) continue;
            const widest = slice.reduce((most, entry) => Math.max(most, Na__LeParamLegend__TextWidth(config, entry.row.Label, sizeMm, weight, tools)), 0);
            columns.push({ rows : slice, natural : (empty ? 0 : swatchW + gap) + widest, x : 0, width : 0 });
        }
        const natural = columns.reduce((sum, column) => sum + column.natural, 0) + (colGap * Math.max(0, columns.length - 1));
        const titleW  = title !== '' ? Na__LeParamLegend__TextWidth(config, title, titleMm, Na__LeParamLegend__Number(config, 'TitleWeight'), tools) : 0;
        const width   = Na__LeParamLegend__Round(Math.max(whole.WidthMm, natural, titleW), 4);
        const extra   = (width - natural) / Math.max(1, columns.length);
        let x = 0;
        columns.forEach((column) => {
            column.x     = x;
            column.width = column.natural + extra;
            x += column.width + colGap;
        });
        const deepest = columns.reduce((most, column) => Math.max(most, column.rows.length), 0);
        return {
            width : width, title : title, titleMm : titleMm, sizeMm : sizeMm, weight : weight, gap : gap,
            swatchW : swatchW, swatchH : swatchH, cellH : cellH, pitch : pitch, firstGap : firstGap,
            columns : columns, empty : empty,
            heightMm : firstGap + (deepest * pitch) - (pitch - cellH)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Swatch's Glyphs
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Pattern's Marks, as the Tools Hand Them Over
    // ------------------------------------------------------------
    // { tileWidthMm, tileHeightMm, strokeMm, opacity, marks : [ [ line... ] ] }
    // in TILE millimetres, each mark already moved to its place in the tile
    // and each line a list of [x, y]. Null when there is no way to get them.
    // ------------------------------------------------------------
    function Na__LeParamLegend__Tile(tools, key) {
        if (!tools || typeof tools.hatchTile !== 'function') return null;
        let tile = null;
        try { tile = tools.hatchTile(key); } catch (error) { tile = null; }
        if (!tile || !(tile.tileWidthMm > 0) || !(tile.tileHeightMm > 0) || !Array.isArray(tile.marks) || !tile.marks.length) return null;
        return tile;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Densest Swatch-Sized Window of a Pattern
    // ------------------------------------------------------------
    // The pattern is laid out as the drawing lays it - scaled, then the whole
    // field turned about its origin - and every window of the swatch's inner
    // size is tried over one repeat of it, a half millimetre at a time. The
    // window holding the most WHOLE marks wins (a mark is never cut: a swatch
    // is a sample, and half a tree reads as a mistake); a tie goes to the one
    // whose marks sit most evenly in it. Returns the chosen marks' lines,
    // moved so the window's corner is (0, 0), or [] when not even one mark
    // fits - the swatch is then its wash and its edge.
    // ------------------------------------------------------------
    function Na__LeParamLegend__PickGlyphs(config, tile, key, scale, rotationDeg, innerW, innerH, strokeMm) {
        if (!(innerW > 0) || !(innerH > 0)) return [];
        const cacheKey = [ key, scale, rotationDeg, Na__LeParamLegend__Round(innerW, 3), Na__LeParamLegend__Round(innerH, 3), Na__LeParamLegend__Round(strokeMm, 4), tile.tileWidthMm, tile.tileHeightMm, tile.marks.length ].join('|');
        if (Na__LeParamLegend__GlyphCache.has(cacheKey)) return Na__LeParamLegend__GlyphCache.get(cacheKey);

        const tw   = tile.tileWidthMm * scale;
        const th   = tile.tileHeightMm * scale;
        const rad  = (rotationDeg * Math.PI) / 180;
        const cos  = Math.cos(rad), sin = Math.sin(rad);
        const half = Math.max(0, strokeMm) / 2;
        const spanX = Math.abs(tw * cos) + Math.abs(th * sin);                 // <-- The box one turned tile covers: every window there is is found inside it
        const spanY = Math.abs(tw * sin) + Math.abs(th * cos);
        const reach = { minX : -1, minY : -1, maxX : spanX + innerW + 1, maxY : spanY + innerH + 1 };

        // THE TILES THAT CAN REACH THE SEARCH, found by taking its corners back
        // through the turn into the tile grid.
        const back = (x, y) => [ (x * cos) + (y * sin), (-x * sin) + (y * cos) ];
        const corners = [ back(reach.minX, reach.minY), back(reach.maxX, reach.minY), back(reach.minX, reach.maxY), back(reach.maxX, reach.maxY) ];
        const lowI  = Math.floor(Math.min(...corners.map((p) => p[0])) / tw) - 1;
        const highI = Math.ceil(Math.max(...corners.map((p) => p[0])) / tw) + 1;
        const lowJ  = Math.floor(Math.min(...corners.map((p) => p[1])) / th) - 1;
        const highJ = Math.ceil(Math.max(...corners.map((p) => p[1])) / th) + 1;
        if ((highI - lowI + 1) * (highJ - lowJ + 1) > Na__LeParamLegend__MAX_TILES) return [];

        // A MARK LANDING EXACTLY ON ANOTHER IS ONE MARK. The woodland's conifer
        // and the pond's ripple each carry a knit copy placed by hand one tile
        // away, from before the library drew seams itself - so once the tiles
        // are laid side by side that glyph lands twice on the same spot, and
        // would be counted twice and drawn twice.
        const marks = [];
        const landed = new Set();
        for (let i = lowI; i <= highI; i++) {
            for (let j = lowJ; j <= highJ; j++) {
                tile.marks.forEach((mark) => {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    const lines = (Array.isArray(mark) ? mark : []).map((line) => (Array.isArray(line) ? line : []).map((point) => {
                        const fx = (point[0] * scale) + (i * tw);
                        const fy = (point[1] * scale) + (j * th);
                        const x  = (fx * cos) - (fy * sin);
                        const y  = (fx * sin) + (fy * cos);
                        if (x < minX) minX = x; if (x > maxX) maxX = x;
                        if (y < minY) minY = y; if (y > maxY) maxY = y;
                        return [ x, y ];
                    })).filter((line) => line.length > 1);
                    if (!lines.length || !Number.isFinite(minX)) return;
                    const box = { minX : minX - half, minY : minY - half, maxX : maxX + half, maxY : maxY + half };
                    if (box.maxX < reach.minX || box.minX > reach.maxX || box.maxY < reach.minY || box.minY > reach.maxY) return;
                    const at = [ box.minX, box.minY, box.maxX, box.maxY ].map((value) => value.toFixed(3)).join(',') + '|' + lines.length;
                    if (landed.has(at)) return;
                    landed.add(at);
                    marks.push({ lines : lines, box : box });
                });
            }
        }

        const step = Math.max(0.1, Na__LeParamLegend__Number(config, 'GlyphSearchStepMm'));
        let best = null;
        for (let wy = 0; wy <= spanY + 1e-9; wy += step) {
            for (let wx = 0; wx <= spanX + 1e-9; wx += step) {
                const inside = marks.filter((mark) => mark.box.minX >= wx && mark.box.maxX <= wx + innerW && mark.box.minY >= wy && mark.box.maxY <= wy + innerH);
                if (!inside.length || (best && inside.length < best.inside.length)) continue;
                const minX = Math.min(...inside.map((mark) => mark.box.minX)), maxX = Math.max(...inside.map((mark) => mark.box.maxX));
                const minY = Math.min(...inside.map((mark) => mark.box.minY)), maxY = Math.max(...inside.map((mark) => mark.box.maxY));
                const off  = Math.hypot(((minX + maxX) / 2) - (wx + (innerW / 2)), ((minY + maxY) / 2) - (wy + (innerH / 2)));
                if (best && inside.length === best.inside.length && off >= best.off - 1e-9) continue;
                best = { inside : inside, off : off, wx : wx, wy : wy };
            }
        }

        let chosen = [];
        if (best) {
            // MORE MARKS THAN A SWATCH SHOULD CARRY: the ones nearest its middle.
            const most   = Math.max(1, Math.round(Na__LeParamLegend__Number(config, 'GlyphMax')));
            const middle = [ best.wx + (innerW / 2), best.wy + (innerH / 2) ];
            const inside = best.inside.length <= most ? best.inside : best.inside.slice()
                .sort((a, b) => Math.hypot(((a.box.minX + a.box.maxX) / 2) - middle[0], ((a.box.minY + a.box.maxY) / 2) - middle[1])
                              - Math.hypot(((b.box.minX + b.box.maxX) / 2) - middle[0], ((b.box.minY + b.box.maxY) / 2) - middle[1]))
                .slice(0, most);
            chosen = inside.map((mark) => mark.lines.map((line) => line.map((point) => [ point[0] - best.wx, point[1] - best.wy ])));
        }
        if (Na__LeParamLegend__GlyphCache.size >= Na__LeParamLegend__GLYPH_CACHE_MAX) Na__LeParamLegend__GlyphCache.delete(Na__LeParamLegend__GlyphCache.keys().next().value);
        Na__LeParamLegend__GlyphCache.set(cacheKey, chosen);
        return chosen;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Records
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Stroked Run, a Filled Box and a Line of Text as Records
    // ------------------------------------------------------------
    // Every opacity is written out, never left to the normaliser: the engine
    // updates members slot for slot, and a value left out would leave the
    // previous occupant's behind - a red 10% wash handing its 10% on to the
    // grass swatch that moved up into its slot.
    // ------------------------------------------------------------
    function Na__LeParamLegend__Run(points, closed, colour, widthMm, opacity) {
        return { kind : 'shape', record : {
            Shape__Points        : points,
            Shape__Closed        : closed === true,
            Shape__Stroked       : true,
            Shape__StrokeColour  : colour,
            Shape__StrokePt      : Na__LeParamLegend__Round(widthMm * Na__LeParamLegend__MM_TO_PT, 4),
            Shape__FillColour    : null,
            Shape__FillOpacity   : 1,
            Shape__StrokeOpacity : (typeof opacity === 'number' && Number.isFinite(opacity)) ? Na__LeParamLegend__Clamp(opacity, 0, 1) : 1
        } };
    }
    function Na__LeParamLegend__Patch(points, colour, opacity) {
        return { kind : 'shape', record : {
            Shape__Points        : points,
            Shape__Closed        : true,
            Shape__Stroked       : false,
            Shape__StrokeColour  : colour,
            Shape__StrokePt      : 0.1,
            Shape__FillColour    : colour,
            Shape__FillOpacity   : (typeof opacity === 'number' && Number.isFinite(opacity)) ? Na__LeParamLegend__Clamp(opacity, 0, 1) : 1,
            Shape__StrokeOpacity : 1
        } };
    }
    function Na__LeParamLegend__Line(text, x, baselineY, sizeMm, weight, colour) {
        return { kind : 'annotation', record : {
            Annotation__Text       : text,
            Annotation__PosXMm     : x,
            Annotation__PosYMm     : baselineY,
            Annotation__SizeMm     : sizeMm,
            Annotation__FontWeight : weight,
            Annotation__Colour     : colour,
            Annotation__Align      : 'left'
        } };
    }
    function Na__LeParamLegend__Box(x, y, w, h) {
        return [ [ x, y ], [ x + w, y ], [ x + w, y + h ], [ x, y + h ] ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Dash as the Round Cap Draws It: a Filled Capsule
    // ------------------------------------------------------------
    // From p to q, a half line width of round end past each. A dash of no
    // length is a dot. Fewer sides on a small one - a 0.2 mm dot does not need
    // the sides a 1 mm one does, and it is stamped a dozen times a run.
    // ------------------------------------------------------------
    function Na__LeParamLegend__Capsule(p, q, widthMm) {
        const r   = widthMm / 2;
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const u   = len > 1e-9 ? [ (q[0] - p[0]) / len, (q[1] - p[1]) / len ] : [ 1, 0 ];
        const n   = [ -u[1], u[0] ];
        const sides  = r < 0.25 ? 6 : 8;                                        // <-- Per half turn, and EVEN: an odd count has no point at the tip and falls short of it
        const points = [];
        const arc = (centre, from) => {
            for (let s = 0; s <= sides; s++) {
                const a = from + ((Math.PI * s) / sides);
                const c = Math.cos(a), si = Math.sin(a);
                points.push([ Na__LeParamLegend__Round(centre[0] + (r * ((c * u[0]) + (si * n[0]))), 4),
                              Na__LeParamLegend__Round(centre[1] + (r * ((c * u[1]) + (si * n[1]))), 4) ]);
            }
        };
        arc(q, -Math.PI / 2);                                                   // <-- Round the far end, from one side to the other
        arc(p,  Math.PI / 2);                                                   // <-- And back round the near end
        return points;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Straight Run in a Line's Own Style
    // ------------------------------------------------------------
    // Solid: one stroked run. Dashed or dotted: the pattern laid from the
    // run's start, as the drawing lays it along each of its edges, each dash a
    // capsule in the line's colour. Pushed onto `out`.
    // ------------------------------------------------------------
    function Na__LeParamLegend__Stroke(out, a, b, line, closedRun) {
        if (!line.DashMm.length) {
            out.push(Na__LeParamLegend__Run(closedRun || [ a, b ], !!closedRun, line.Hex, line.WidthMm, 1));
            return;
        }
        const runs = closedRun ? closedRun.map((point, index) => [ point, closedRun[(index + 1) % closedRun.length] ]) : [ [ a, b ] ];
        runs.forEach((run) => {
            const p = run[0], q = run[1];
            const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
            if (!(length > 0)) return;
            const u = [ (q[0] - p[0]) / length, (q[1] - p[1]) / length ];
            const at = (t) => [ p[0] + (u[0] * t), p[1] + (u[1] * t) ];
            let t = 0, k = 0, pieces = 0;
            while (t < length - 1e-9 && pieces < Na__LeParamLegend__MAX_PIECES) {
                const size = line.DashMm[k % line.DashMm.length];
                if (k % 2 === 0) {
                    out.push(Na__LeParamLegend__Patch(Na__LeParamLegend__Capsule(at(t), at(Math.min(length, t + size)), line.WidthMm), line.Hex, 1));
                    pieces++;
                }
                t += size;                                                          // <-- The pattern adds up to more than nothing (Dash), so this always moves on
                k++;
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Legend
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Legend: Parameters In, Records Out
    // ------------------------------------------------------------
    // { records : [{ kind, record }], sizeMm }, from an origin of (0, 0) at
    // the LEFT END OF THE TOP RULE, the title above it and the rows below.
    // ------------------------------------------------------------
    function Na__LeParamLegend__Build(config, params, tools) {
        const whole  = Na__LeParamLegend__Normalise(config, params);
        const rows   = Na__LeParamLegend__Rows(config, whole);
        const lay    = Na__LeParamLegend__Layout(config, whole, rows, tools);
        const shapes = [];
        const texts  = [];
        const round  = (value) => Na__LeParamLegend__Round(value, 4);

        // THE TOP RULE IS THE FIRST VECTOR AND ITS FIRST POINT IS THE ORIGIN
        shapes.push(Na__LeParamLegend__Run([ [ 0, 0 ], [ lay.width, 0 ] ], false, Na__LeParamLegend__Text(config, 'RuleColour'), Na__LeParamLegend__Number(config, 'RulePt') / Na__LeParamLegend__MM_TO_PT, 1));

        // THE TITLE | Above the rule, as a drawing title sits above its own
        if (lay.title !== '') texts.push(Na__LeParamLegend__Line(lay.title, 0, -Na__LeParamLegend__Number(config, 'TitleAboveRuleMm') * (lay.sizeMm / Na__LeParamLegend__Number(config, 'TextSizeMm')), lay.titleMm, Na__LeParamLegend__Number(config, 'TitleWeight'), Na__LeParamLegend__Text(config, 'TitleColour')));

        const inset = Na__LeParamLegend__Number(config, 'GlyphInsetMm');
        lay.columns.forEach((column) => {
            column.rows.forEach((entry, index) => {
                const top      = lay.firstGap + (index * lay.pitch);
                const baseline = round(top + (lay.cellH / 2) + (0.36 * lay.sizeMm));    // <-- The middle of a capital sits on the middle of the swatch
                if (entry.kind === 'empty') {
                    texts.push(Na__LeParamLegend__Line(entry.row.Label, round(column.x), baseline, lay.sizeMm, lay.weight, Na__LeParamLegend__Text(config, 'MutedColour')));
                    return;
                }
                const row = entry.row;
                const sx  = round(column.x);
                const sy  = round(top + ((lay.cellH - lay.swatchH) / 2));

                if (entry.kind === Na__LeParamLegend__KIND_LINE) {
                    const mid = round(sy + (lay.swatchH / 2));
                    Na__LeParamLegend__Stroke(shapes, [ sx, mid ], [ round(sx + lay.swatchW), mid ], row.Line, null);
                } else {
                    const box = Na__LeParamLegend__Box(sx, sy, lay.swatchW, lay.swatchH).map((point) => [ round(point[0]), round(point[1]) ]);
                    // THE WASH, THEN THE HATCH, THEN THE EDGE: the drawing's
                    // own three decks, bottom to top.
                    if (row.Fill) shapes.push(Na__LeParamLegend__Patch(box, row.Fill.Hex, row.Fill.Opacity));
                    const tile = row.Hatch ? Na__LeParamLegend__Tile(tools, row.Hatch.Key) : null;
                    if (tile) {
                        const strokeMm = Number.isFinite(row.Hatch.StrokePt) ? row.Hatch.StrokePt / Na__LeParamLegend__MM_TO_PT : tile.strokeMm * row.Hatch.Scale;
                        const edge     = row.Line ? row.Line.WidthMm / 2 : 0;
                        const pad      = inset + edge;
                        const glyphs   = Na__LeParamLegend__PickGlyphs(config, tile, row.Hatch.Key, row.Hatch.Scale, row.Hatch.RotationDeg, lay.swatchW - (2 * pad), lay.swatchH - (2 * pad), strokeMm);
                        const opacity  = (typeof tile.opacity === 'number' && Number.isFinite(tile.opacity)) ? tile.opacity : 1;
                        glyphs.forEach((mark) => mark.forEach((line) => {
                            shapes.push(Na__LeParamLegend__Run(line.map((point) => [ round(sx + pad + point[0]), round(sy + pad + point[1]) ]), false, row.Hatch.Colour, strokeMm, opacity));
                        }));
                    }
                    if (row.Line) Na__LeParamLegend__Stroke(shapes, null, null, row.Line, box);
                }
                texts.push(Na__LeParamLegend__Line(row.Label, round(column.x + lay.swatchW + lay.gap), baseline, lay.sizeMm, lay.weight, Na__LeParamLegend__Text(config, 'TextColour')));
            });
        });

        return {
            records : shapes.concat(texts),
            sizeMm  : { WidthMm : lay.width, HeightMm : lay.heightMm },
            rows    : rows.filter((entry) => entry.kind !== 'empty').length       // <-- What the panel and the tests read back
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Legend Drawn as Wide as Its Words Now Need
    // ------------------------------------------------------------
    // For the engine's refit: the top rule as it stands against the width the
    // measure gives now. Only asked once the measure is the paper's own.
    // ------------------------------------------------------------
    function Na__LeParamLegend__Misfits(config, params, tools, records) {
        const rule   = (records && Array.isArray(records.shapes)) ? records.shapes[0] : null;
        const points = (rule && Array.isArray(rule.Shape__Points)) ? rule.Shape__Points : null;
        if (!points || points.length !== 2 || !Array.isArray(points[0]) || !Array.isArray(points[1])) return false;
        if (!tools || typeof tools.measureTextMm !== 'function') return false;
        const whole = Na__LeParamLegend__Normalise(config, params);
        const lay   = Na__LeParamLegend__Layout(config, whole, Na__LeParamLegend__Rows(config, whole), tools);
        const drawn = Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]);
        return Number.isFinite(drawn) && Math.abs(drawn - lay.width) > Na__LeParamLegend__FIT_SLACK_MM;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Grips and the Menu
// -----------------------------------------------------------------------------

    // FUNCTION | Where the Legend's Grips Stand, From Its Origin
    // ------------------------------------------------------------
    // The STRETCH arrow at the right end of the top rule sets the width the
    // legend is at least - which lines it up with a title block - and the
    // LOOKUP triangle at the left end carries everything else. No link
    // socket: a legend reads every site plan on its sheet, and a cable to the
    // nearest one would say something untrue about what it lists.
    // ------------------------------------------------------------
    function Na__LeParamLegend__Handles(config, params, tools) {
        const whole = Na__LeParamLegend__Normalise(config, params);
        const lay   = Na__LeParamLegend__Layout(config, whole, Na__LeParamLegend__Rows(config, whole), tools);
        return {
            stretch : { x : lay.width, y : 0, away : [ 1, 0 ] },
            lookup  : { x : 0, y : 0, away : [ -Math.SQRT1_2, -Math.SQRT1_2 ] },
            slide   : null,
            link    : null
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Parameters a Stretch Grip Dragged to a Point Gives
    // ------------------------------------------------------------
    // Dragged in past what the words need, the legend stops at its words: the
    // width is a minimum, so it is recorded and drawn no narrower than that.
    // ------------------------------------------------------------
    function Na__LeParamLegend__StretchTo(config, params, xMm) {
        const whole = Na__LeParamLegend__Normalise(config, params);
        if (!Number.isFinite(xMm)) return whole;
        const step = Math.max(0.1, Na__LeParamLegend__Number(config, 'WidthStepMm'));
        return Na__LeParamLegend__Normalise(config, Object.assign({}, whole, { WidthMm : Math.max(0, Math.round(xMm / step) * step) }));
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Lookup Grip's Menu Offers
    // ------------------------------------------------------------
    // The columns, the switch for line rows, then every row the sheet shows,
    // ticked while it is listed - so a row is taken off, or put back, with one
    // click on the sheet. Each entry is a patch the engine merges as one undo
    // step - the same rebuild the panel's controls make.
    // ------------------------------------------------------------
    function Na__LeParamLegend__Choices(config, params, words) {
        const whole = Na__LeParamLegend__Normalise(config, params);
        const said  = (words && typeof words === 'object') ? words : {};
        const most  = Math.max(1, Math.round(Na__LeParamLegend__Number(config, 'ColumnsMax')));
        const items = [ { label : said.autoColumns || 'Columns as the rows need', checked : whole.Columns === 0, patch : { Columns : 0 } } ];
        for (let n = 1; n <= most; n++) {
            items.push({ label : (n === 1 ? (said.oneColumn || 'One column') : (said.columns || '{count} columns').split('{count}').join(String(n))), checked : whole.Columns === n, patch : { Columns : n } });
        }
        items.push({ separator : true });
        items.push({ label : said.showLines || 'Lines as well as areas', checked : whole.ShowLines, patch : { ShowLines : !whole.ShowLines } });

        const rows = whole.Data.Rows;
        if (rows.length) {
            items.push({ separator : true });
            rows.forEach((row) => {
                const off  = whole.Hidden.indexOf(row.Key) !== -1;
                const next = off ? whole.Hidden.filter((key) => key !== row.Key) : whole.Hidden.concat([ row.Key ]);
                items.push({ label : row.Label, checked : !off, patch : { Hidden : next } });
            });
            if (rows.some((row) => whole.Hidden.indexOf(row.Key) !== -1)) {
                items.push({ label : said.showAll || 'List every row', checked : false, patch : { Hidden : whole.Hidden.filter((key) => !rows.some((row) => row.Key === key)) } });
            }
        }
        return items;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Type
// -----------------------------------------------------------------------------

    // FUNCTION | The Site Plan Legend's Definition, for the Engine's Registry
    // ------------------------------------------------------------
    // getConfig() answers the config's SiteLegend block and getMenuWords() the
    // menu's wording, each read fresh on every call. linkable is false: a
    // legend reads the sheet's site plans, never one viewport's scale.
    // ------------------------------------------------------------
    function Na__LeParamLegend__CreateType(getConfig, getMenuWords) {
        const config = () => ((typeof getConfig === 'function' ? getConfig() : null) || {});
        const words  = () => ((typeof getMenuWords === 'function' ? getMenuWords() : null) || null);
        return {
            type      : Na__LeParamLegend__TYPE,
            keep      : Na__LeParamLegend__KEEP.slice(),
            linkable  : false,
            facts     : [ 'Data' ],                                              // <-- What the site legend link fills in, as a viewport fills a drawing title's
            defaults  : ()                       => Na__LeParamLegend__Standard(config()),
            normalise : (params)                 => Na__LeParamLegend__Normalise(config(), params),
            build     : (params, tools)          => Na__LeParamLegend__Build(config(), params, tools),
            handles   : (params, tools)          => Na__LeParamLegend__Handles(config(), params, tools),
            stretchTo : (params, xMm)            => Na__LeParamLegend__StretchTo(config(), params, xMm),
            choices   : (params)                 => Na__LeParamLegend__Choices(config(), params, words()),
            refit     : (params, tools, records) => Na__LeParamLegend__Misfits(config(), params, tools, records),
            hasBar    : ()                       => false,
            rowsOf    : (params)                 => Na__LeParamLegend__Rows(config(), Na__LeParamLegend__Normalise(config(), params)),
            columnsMax : ()                      => Math.max(1, Math.round(Na__LeParamLegend__Number(config(), 'ColumnsMax')))
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Site Plan Legend API
    // ------------------------------------------------------------
    export {
        Na__LeParamLegend__TYPE,
        Na__LeParamLegend__KIND_AREA,
        Na__LeParamLegend__KIND_LINE,
        Na__LeParamLegend__Standard,
        Na__LeParamLegend__Normalise,
        Na__LeParamLegend__NormaliseData,
        Na__LeParamLegend__Rows,
        Na__LeParamLegend__Layout,
        Na__LeParamLegend__PickGlyphs,
        Na__LeParamLegend__Capsule,
        Na__LeParamLegend__Build,
        Na__LeParamLegend__Misfits,
        Na__LeParamLegend__Handles,
        Na__LeParamLegend__StretchTo,
        Na__LeParamLegend__Choices,
        Na__LeParamLegend__CreateType
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
