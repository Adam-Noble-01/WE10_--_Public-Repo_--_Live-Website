// =============================================================================
// TRUEVISION3D - COLOUR PALETTE - MANAGER
// =============================================================================
//
// FILE       : Na__ColourPalette__Manager__.js
// NAMESPACE  : Na__ColourPalette
// MODULE     : Colour Palette - Manager
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Load the standard colours, and answer which palettes, groups and colours there are
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE STANDARD COLOURS LIVE IN ONE FILE, Na__ColourPalette__Config__.json,
//   beside this module: PALETTES hold GROUPS and groups hold COLOURS, each
//   keyed by its technical name (ColourPalette__{Group}__{Colour}) and each
//   carrying a menu name for a person to read. This module reads that file
//   once and turns it into plain ordered lists, so nothing that draws the
//   palette has to know how the file is nested.
// - ONE PALETTE IS ON SHOW AT A TIME. Which one is remembered in this
//   browser, like a panel's fold; a key the file no longer has falls back to
//   the config's default, and that to the first palette written.
// - A COLOUR IS A SIX-DIGIT HEX, lower case, because that is the only form an
//   <input type="color"> reads and reports. The file may write upper case (the
//   SSOT does) or give Colour__Rgb alone; both come out the same here.
// - THIS FILE IS A LEAF ON PURPOSE. It imports nothing, so the Layout Editor's
//   panel host, the 3D tab's Plan Annotations toolbar and anything written
//   later can all reach the palette without an import cycle.
// - NEVER THROWS AND NEVER REJECTS. A missing or broken config leaves the
//   palette empty, and an empty palette means every colour field opens the
//   browser's own colour menu exactly as it did before this module existed.
//
// INTEGRATION:
// - Na__ColourPalette__Picker__ draws what this module holds.
// - Everything outside this folder imports through Na__ColourPalette__.js.
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
// 21-Sep-2026 - Version 1.1.0
// - The display settings carry the SIZE of the browser's own colour mixer
//   (NativePickerWidthPx, NativePickerHeightPx, NativePickerGapPx) and whether
//   it is corrected for the page zoom (NativePickerFollowsZoom), in place of
//   the height once kept clear below the field (NativePickerRoomPx): the mixer
//   now sits on top of the palette, so what the picker needs is how big it is.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the loader, the ordered readers, the active
//   palette and its remembered copy, and lookup by technical name and by hex.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Config Lives, the Event and the Remembered Choice
    // ------------------------------------------------------------
    const Na__ColourPalette__CONFIG_URL    = new URL('./Na__ColourPalette__Config__.json', import.meta.url).href;
    const Na__ColourPalette__CHANGED_EVENT = 'na-colourpalette-changed';       // <-- detail { reason : 'loaded' | 'active-palette', paletteKey }
    const Na__ColourPalette__STORE_KEY     = 'na-colourpalette-active';        // <-- The technical name of the palette last on show
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What the Palette Shows With Before, or Without, a Config
    // ------------------------------------------------------------
    const Na__ColourPalette__DISPLAY_DEFAULTS = Object.freeze({
        enabled            : true,
        defaultPaletteKey  : '',
        swatchSizePx       : 22,
        swatchGapPx        : 4,
        swatchesPerRow     : 12,
        showGroupNames          : true,
        showReadout             : true,
        openNativePicker        : true,
        nativePickerWidthPx     : 232,                                           // <-- The browser's own colour mixer, as Chrome and Edge draw it
        nativePickerHeightPx    : 250,
        nativePickerGapPx       : 4,
        nativePickerFollowsZoom : true
    });
    const Na__ColourPalette__LABEL_DEFAULTS = Object.freeze({
        Title        : 'Colour Palette',
        PaletteMenu  : 'Palette',
        Current      : 'Current',
        NotInPalette : 'custom colour',
        SwatchTitle  : '{menuName}  {hex}  -  {technicalName}'
    });
    // ------------------------------------------------------------

    // MODULE VARIABLES | Session State
    // ------------------------------------------------------------
    let   Na__ColourPalette__Loaded    = false;
    let   Na__ColourPalette__Loading   = null;                                 // <-- The one load in flight
    let   Na__ColourPalette__Display   = Object.assign({}, Na__ColourPalette__DISPLAY_DEFAULTS);
    let   Na__ColourPalette__Labels    = Object.assign({}, Na__ColourPalette__LABEL_DEFAULTS);
    let   Na__ColourPalette__ActiveKey = null;                                 // <-- null until first asked for
    const Na__ColourPalette__Palettes  = [];                                   // <-- [{ Palette__Key, Palette__MenuName, Palette__Groups : [] }]
    const Na__ColourPalette__ByName    = new Map();                            // <-- Technical name -> colour
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Colour Values
// -----------------------------------------------------------------------------

    // FUNCTION | Any Colour This Codebase Writes, as a Lower Case Six-Digit Hex (or null)
    // ------------------------------------------------------------
    // Takes '#RRGGBB', '#RGB', 'rgb(r, g, b)' and [r, g, b]. Anything else -
    // a name, an alpha colour, a typo - is null, so a caller can tell "not a
    // colour" from black.
    // ------------------------------------------------------------
    function Na__ColourPalette__ToHex(value) {
        if (Array.isArray(value)) {
            if (value.length !== 3 || !value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return null;
            return '#' + value.map((n) => n.toString(16).padStart(2, '0')).join('');
        }
        const text = String(value === undefined || value === null ? '' : value).trim();
        const long = /^#([0-9a-fA-F]{6})$/.exec(text);
        if (long) return '#' + long[1].toLowerCase();
        const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(text);
        if (short) return ('#' + short[1] + short[1] + short[2] + short[2] + short[3] + short[3]).toLowerCase();
        const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(text);
        if (rgb) return Na__ColourPalette__ToHex([ parseInt(rgb[1], 10), parseInt(rgb[2], 10), parseInt(rgb[3], 10) ]);
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Hex as Its Three Channels
    // ------------------------------------------------------------
    function Na__ColourPalette__ToRgb(hex) {
        const value = Na__ColourPalette__ToHex(hex);
        if (!value) return null;
        return [ parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16) ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading the Config
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The One Block in a File Whose Key Ends With a Suffix
    // ------------------------------------------------------------
    function Na__ColourPalette__Block(doc, suffix) {
        if (!doc || typeof doc !== 'object') return null;
        const key = Object.keys(doc).find((name) => name.endsWith(suffix));
        return key ? doc[key] : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Colour Block Into the Shape the Picker Wants (or null)
    // ------------------------------------------------------------
    // The KEY is the technical name. Colour__TechnicalName is written in the
    // block as well so a block reads whole on its own; when the two disagree
    // the key wins and the console says so, because the key is what is unique.
    // ------------------------------------------------------------
    function Na__ColourPalette__ParseColour(key, block, group) {
        if (!block || typeof block !== 'object') return null;
        const fromHex = Na__ColourPalette__ToHex(block.Colour__Hex);
        const fromRgb = Na__ColourPalette__ToHex(block.Colour__Rgb);
        const hex     = fromHex || fromRgb;
        if (!hex) {
            console.warn('[TrueVision3D ColourPalette] ' + key + ' has no readable Colour__Hex or Colour__Rgb; skipped.');
            return null;
        }
        if (fromHex && fromRgb && fromHex !== fromRgb) {
            console.warn('[TrueVision3D ColourPalette] ' + key + ': Colour__Hex ' + fromHex + ' and Colour__Rgb ' + fromRgb + ' disagree; the hex is used.');
        }
        if (typeof block.Colour__TechnicalName === 'string' && block.Colour__TechnicalName !== key) {
            console.warn('[TrueVision3D ColourPalette] ' + key + ' names itself ' + block.Colour__TechnicalName + '; the key is used.');
        }
        if (typeof block.Colour__MenuGroup === 'string' && block.Colour__MenuGroup !== group.Group__MenuName) {
            console.warn('[TrueVision3D ColourPalette] ' + key + ' says its menu group is "' + block.Colour__MenuGroup + '" but sits in "' + group.Group__MenuName + '"; where it sits is used.');
        }
        return {
            Colour__Key           : key,
            Colour__TechnicalName : key,
            Colour__MenuName      : (typeof block.Colour__MenuName === 'string' && block.Colour__MenuName) ? block.Colour__MenuName : key,
            Colour__MenuGroup     : group.Group__MenuName,
            Colour__GroupKey      : group.Group__Key,
            Colour__Hex           : hex,
            Colour__Rgb           : Na__ColourPalette__ToRgb(hex),
            Colour__SsotKey       : typeof block.Colour__SsotKey === 'string' ? block.Colour__SsotKey : '',
            Colour__Note          : typeof block.Colour__Note === 'string' ? block.Colour__Note : ''
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Whole Config Into Ordered Lists
    // ------------------------------------------------------------
    // Object key order is the order written in the file, which is the order a
    // person arranged the swatches in - so it is the order they are shown in.
    // A technical name met a second time is skipped: it is what other configs
    // will refer to, and two colours answering to one name is a silent wrong
    // colour somewhere later.
    // ------------------------------------------------------------
    function Na__ColourPalette__Parse(doc) {
        const display = Na__ColourPalette__Block(doc, '__Display') || {};
        const labels  = Na__ColourPalette__Block(doc, '__Labels')  || {};
        const source  = Na__ColourPalette__Block(doc, '__Palettes');

        const num  = (value, fallback, min, max) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);
        const flag = (value, fallback) => (typeof value === 'boolean' ? value : fallback);
        const D    = Na__ColourPalette__DISPLAY_DEFAULTS;
        Na__ColourPalette__Display = {
            enabled            : flag(display.Display__Enabled, D.enabled),
            defaultPaletteKey  : typeof display.Display__DefaultPaletteKey === 'string' ? display.Display__DefaultPaletteKey : D.defaultPaletteKey,
            swatchSizePx       : num(display.Display__SwatchSizePx, D.swatchSizePx, 12, 48),
            swatchGapPx        : num(display.Display__SwatchGapPx, D.swatchGapPx, 0, 16),
            swatchesPerRow     : Math.round(num(display.Display__SwatchesPerRow, D.swatchesPerRow, 4, 32)),
            showGroupNames          : flag(display.Display__ShowGroupNames, D.showGroupNames),
            showReadout             : flag(display.Display__ShowReadout, D.showReadout),
            openNativePicker        : flag(display.Display__OpenNativePicker, D.openNativePicker),
            nativePickerWidthPx     : num(display.Display__NativePickerWidthPx, D.nativePickerWidthPx, 100, 800),
            nativePickerHeightPx    : num(display.Display__NativePickerHeightPx, D.nativePickerHeightPx, 100, 800),
            nativePickerGapPx       : num(display.Display__NativePickerGapPx, D.nativePickerGapPx, 0, 40),
            nativePickerFollowsZoom : flag(display.Display__NativePickerFollowsZoom, D.nativePickerFollowsZoom)
        };

        const words = Object.assign({}, Na__ColourPalette__LABEL_DEFAULTS);
        Object.keys(Na__ColourPalette__LABEL_DEFAULTS).forEach((name) => {
            if (typeof labels['Labels__' + name] === 'string' && labels['Labels__' + name]) words[name] = labels['Labels__' + name];
        });
        Na__ColourPalette__Labels = words;

        Na__ColourPalette__Palettes.length = 0;
        Na__ColourPalette__ByName.clear();
        if (!source || typeof source !== 'object') return;

        Object.keys(source).forEach((paletteKey) => {
            const paletteBlock = source[paletteKey];
            if (!paletteBlock || typeof paletteBlock !== 'object') return;
            const palette = {
                Palette__Key         : paletteKey,
                Palette__MenuName    : (typeof paletteBlock.Palette__MenuName === 'string' && paletteBlock.Palette__MenuName) ? paletteBlock.Palette__MenuName : paletteKey,
                Palette__Description : typeof paletteBlock.Palette__Description === 'string' ? paletteBlock.Palette__Description : '',
                Palette__Groups      : []
            };
            const groups = (paletteBlock.Palette__Groups && typeof paletteBlock.Palette__Groups === 'object') ? paletteBlock.Palette__Groups : {};
            Object.keys(groups).forEach((groupKey) => {
                const groupBlock = groups[groupKey];
                if (!groupBlock || typeof groupBlock !== 'object') return;
                const group = {
                    Group__Key         : groupKey,
                    Group__MenuName    : (typeof groupBlock.Group__MenuName === 'string' && groupBlock.Group__MenuName) ? groupBlock.Group__MenuName : groupKey,
                    Group__Description : typeof groupBlock.Group__Description === 'string' ? groupBlock.Group__Description : '',
                    Group__PaletteKey  : paletteKey,
                    Group__Colours     : []
                };
                const colours = (groupBlock.Group__Colours && typeof groupBlock.Group__Colours === 'object') ? groupBlock.Group__Colours : {};
                Object.keys(colours).forEach((colourKey) => {
                    if (Na__ColourPalette__ByName.has(colourKey)) {
                        console.warn('[TrueVision3D ColourPalette] The technical name ' + colourKey + ' is used twice; the second is skipped.');
                        return;
                    }
                    const colour = Na__ColourPalette__ParseColour(colourKey, colours[colourKey], group);
                    if (!colour) return;
                    group.Group__Colours.push(colour);
                    Na__ColourPalette__ByName.set(colourKey, colour);
                });
                if (group.Group__Colours.length) palette.Palette__Groups.push(group);   // <-- An empty group would be a caption over nothing
            });
            if (palette.Palette__Groups.length) Na__ColourPalette__Palettes.push(palette);
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the Config Once
    // ------------------------------------------------------------
    function Na__ColourPalette__Ready() {
        if (Na__ColourPalette__Loaded) return Promise.resolve();
        if (Na__ColourPalette__Loading) return Na__ColourPalette__Loading;

        Na__ColourPalette__Loading = (async () => {
            let doc = null;
            try {
                const response = await fetch(Na__ColourPalette__CONFIG_URL, { cache : 'no-store' });
                if (response.ok) doc = await response.json();
            } catch (error) {
                doc = null;
            }
            if (doc) {
                try { Na__ColourPalette__Parse(doc); }
                catch (error) { console.warn('[TrueVision3D ColourPalette] The palette config could not be read:', error); }
            } else {
                console.warn('[TrueVision3D ColourPalette] Palette config not found; colour fields open the browser colour menu only.');
            }
            Na__ColourPalette__Loaded = true;
            console.log('[TrueVision3D ColourPalette] ' + Na__ColourPalette__ByName.size + ' colour(s) in ' + Na__ColourPalette__Palettes.length + ' palette(s).');
            Na__ColourPalette__Announce('loaded');
        })();

        return Na__ColourPalette__Loading;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell Anyone Listening That the Palette Changed
    // ------------------------------------------------------------
    function Na__ColourPalette__Announce(reason) {
        if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
        const active = Na__ColourPalette__GetActivePalette();
        window.dispatchEvent(new CustomEvent(Na__ColourPalette__CHANGED_EVENT, { detail : { reason : reason, paletteKey : active ? active.Palette__Key : null } }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Palettes
// -----------------------------------------------------------------------------

    // FUNCTION | Readers
    // ------------------------------------------------------------
    function Na__ColourPalette__IsLoaded()    { return Na__ColourPalette__Loaded; }
    function Na__ColourPalette__GetDisplay()  { return Na__ColourPalette__Display; }
    function Na__ColourPalette__GetPalettes() { return Na__ColourPalette__Palettes; }
    function Na__ColourPalette__GetLabel(name, fallback) {
        const value = Na__ColourPalette__Labels[name];
        return (typeof value === 'string' && value) ? value : (fallback || '');
    }
    // ------------------------------------------------------------


    // FUNCTION | Is There Anything to Show
    // ------------------------------------------------------------
    // False until the config has loaded, false when it is switched off and
    // false when it holds no colours - the three cases where a colour field
    // must behave exactly as the browser makes it.
    // ------------------------------------------------------------
    function Na__ColourPalette__IsAvailable() {
        return Na__ColourPalette__Loaded && Na__ColourPalette__Display.enabled && Na__ColourPalette__Palettes.length > 0;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Palette on Show
    // ------------------------------------------------------------
    // The remembered one, else the config's default, else the first written.
    // ------------------------------------------------------------
    function Na__ColourPalette__GetActivePalette() {
        const palettes = Na__ColourPalette__Palettes;
        if (!palettes.length) return null;
        if (Na__ColourPalette__ActiveKey === null) {
            let stored = null;
            try { stored = window.localStorage.getItem(Na__ColourPalette__STORE_KEY); } catch (error) { stored = null; }
            Na__ColourPalette__ActiveKey = stored || '';
        }
        return palettes.find((palette) => palette.Palette__Key === Na__ColourPalette__ActiveKey)
            || palettes.find((palette) => palette.Palette__Key === Na__ColourPalette__Display.defaultPaletteKey)
            || palettes[0];
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Another Palette on Show (remembered in this browser)
    // ------------------------------------------------------------
    // Returns true only when the palette on show changed.
    // ------------------------------------------------------------
    function Na__ColourPalette__SetActivePalette(paletteKey) {
        const before = Na__ColourPalette__GetActivePalette();
        if (!Na__ColourPalette__Palettes.some((palette) => palette.Palette__Key === paletteKey)) return false;
        if (before && before.Palette__Key === paletteKey) return false;
        Na__ColourPalette__ActiveKey = paletteKey;
        try { window.localStorage.setItem(Na__ColourPalette__STORE_KEY, paletteKey); } catch (error) { /* storage unavailable: the choice still holds for this session */ }
        Na__ColourPalette__Announce('active-palette');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Colour by Its Technical Name, and Its Hex With a Fallback
    // ------------------------------------------------------------
    // Hex is what another module asks when it wants a standard colour rather
    // than a literal: Na__ColourPalette__Hex('ColourPalette__Dimensions__Proposed', '#960000').
    // The fallback is returned until the config has loaded and for a name the
    // file no longer has, so a caller never paints with undefined.
    // ------------------------------------------------------------
    function Na__ColourPalette__FindColour(technicalName) {
        return Na__ColourPalette__ByName.get(technicalName) || null;
    }
    function Na__ColourPalette__Hex(technicalName, fallback) {
        const colour = Na__ColourPalette__ByName.get(technicalName);
        return colour ? colour.Colour__Hex : (fallback === undefined ? null : fallback);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Colour of a Palette That Has This Hex (the first, or null)
    // ------------------------------------------------------------
    // What the picker names in its readout as the field's current colour. Two
    // groups may hold the same hex (black was once in Monochrome AND in
    // Dimensions), so the first in the palette's own order answers.
    // ------------------------------------------------------------
    function Na__ColourPalette__FindByHex(hex, palette) {
        const value = Na__ColourPalette__ToHex(hex);
        const from  = palette || Na__ColourPalette__GetActivePalette();
        if (!value || !from) return null;
        for (const group of from.Palette__Groups) {
            const found = group.Group__Colours.find((colour) => colour.Colour__Hex === value);
            if (found) return found;
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Colour Palette Manager API
    // ------------------------------------------------------------
    export {
        Na__ColourPalette__CHANGED_EVENT,
        Na__ColourPalette__Ready,
        Na__ColourPalette__IsLoaded,
        Na__ColourPalette__IsAvailable,
        Na__ColourPalette__GetDisplay,
        Na__ColourPalette__GetLabel,
        Na__ColourPalette__GetPalettes,
        Na__ColourPalette__GetActivePalette,
        Na__ColourPalette__SetActivePalette,
        Na__ColourPalette__FindColour,
        Na__ColourPalette__FindByHex,
        Na__ColourPalette__Hex,
        Na__ColourPalette__ToHex,
        Na__ColourPalette__ToRgb
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
