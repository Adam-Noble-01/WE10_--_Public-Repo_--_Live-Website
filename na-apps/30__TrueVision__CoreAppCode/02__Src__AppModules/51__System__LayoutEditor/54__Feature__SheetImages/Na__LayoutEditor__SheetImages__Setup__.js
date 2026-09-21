// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES - SETUP
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__Setup__.js
// NAMESPACE  : Na__LeImgCfg
// MODULE     : Layout Editor - Sheet Images - Setup
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Load the Sheet Images config once and answer every setting with its fallback
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - A LEAF: it imports nothing, so the record normaliser, the painter and the
//   PDF exporter can all read the frame and the storage settings without any
//   of them reaching the rest of the feature - or each other.
// - Every reader has a built-in fallback equal to the shipped config, so a
//   picture drawn before the fetch lands, or on a build where the file is
//   missing, looks exactly as it will once it arrives.
//
// INTEGRATION:
// - Ready() is in the mode controller's first-open wait, beside the other
//   feature configs, so nothing is drawn against the fallbacks by accident.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - Storage: quality 0.90 by default and never above 0.99 - Chrome writes a
//   WebP of quality 1.0 LOSSLESS (10.8 MB for a 3840 x 2160 render, against
//   3.6 MB at 0.99) - and printDpi / printHeadroom, the resolution a picture
//   is stored at for the size it is drawn. Pdf: JPEG 0.95 by default.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Config Is and What Its Blocks Are Called
    // ------------------------------------------------------------
    const Na__LeImgCfg__ConfigUrl = new URL('./Na__LayoutEditor__SheetImages__Config__.json', import.meta.url);
    const Na__LeImgCfg__PREFIX    = 'LayoutEditor__SheetImages__';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Config Once Loaded, and the Load in Flight
    // ------------------------------------------------------------
    let Na__LeImgCfg__Config  = null;
    let Na__LeImgCfg__Loading = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading and Reading
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Config Once
    // ------------------------------------------------------------
    // Never rejects. A missing file leaves every reader on its fallback, so
    // pictures are drawn and stored with the standard settings rather than
    // not at all.
    // ------------------------------------------------------------
    function Na__LeImgCfg__Ready() {
        if (!Na__LeImgCfg__Loading) {
            Na__LeImgCfg__Loading = (async () => {
                try {
                    const response = await fetch(Na__LeImgCfg__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeImgCfg__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Sheet Images config unavailable - the built-in settings are used.', error);
                    Na__LeImgCfg__Config = null;
                }
                return Na__LeImgCfg__Config;
            })();
        }
        return Na__LeImgCfg__Loading;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Value From One Block, or Its Fallback
    // ------------------------------------------------------------
    // The fallback's type is the type asked for: a number must be a finite
    // number, a flag a boolean, a list a list, and a word a non-empty string.
    // ------------------------------------------------------------
    function Na__LeImgCfg__Value(block, key, fallback) {
        const holder = Na__LeImgCfg__Config ? Na__LeImgCfg__Config[Na__LeImgCfg__PREFIX + block] : null;
        const value  = (holder && typeof holder === 'object' && !Array.isArray(holder)) ? holder[block + '__' + key] : undefined;
        if (typeof fallback === 'number')  return (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
        if (typeof fallback === 'boolean') return (typeof value === 'boolean') ? value : fallback;
        if (Array.isArray(fallback))       return Array.isArray(value) ? value.slice() : fallback.slice();
        return (typeof value === 'string' && value !== '') ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Label, With {tokens} Filled In
    // ------------------------------------------------------------
    function Na__LeImgCfg__Label(key, fallback, tokens) {
        let text = Na__LeImgCfg__Value('Labels', key, fallback);
        Object.keys(tokens || {}).forEach((name) => { text = text.split('{' + name + '}').join(String(tokens[name])); });
        return text;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Settings, Grouped
// -----------------------------------------------------------------------------

    // FUNCTION | How a Picture Is Stored
    // ------------------------------------------------------------
    // Not where: 05__Layout__DrawingDocs__Images never changes, so the R2
    // client and the local server route name it, and nothing here can move it.
    // ------------------------------------------------------------
    function Na__LeImgCfg__Storage() {
        return {
            format            : Na__LeImgCfg__Value('Storage', 'Format', 'image/webp'),
            quality           : Math.max(0.5, Math.min(0.99, Na__LeImgCfg__Value('Storage', 'Quality', 0.9))),   // <-- 1.0 would be a lossless WebP near the size of the PNG
            maxEdgePx         : Math.max(256, Math.round(Na__LeImgCfg__Value('Storage', 'MaxEdgePx', 4096))),
            printDpi          : Math.max(72, Math.min(1200, Na__LeImgCfg__Value('Storage', 'PrintDpi', 300))),
            printHeadroom     : Math.max(1, Math.min(2, Na__LeImgCfg__Value('Storage', 'PrintHeadroom', 1))),
            passThroughTypes  : Na__LeImgCfg__Value('Storage', 'PassThroughTypes', [ 'image/webp', 'image/jpeg' ]),
            passThroughMaxBytes : Na__LeImgCfg__Value('Storage', 'PassThroughMaxBytes', 6291456),
            maxInputBytes     : Na__LeImgCfg__Value('Storage', 'MaxInputBytes', 104857600),
            acceptTypes       : Na__LeImgCfg__Value('Storage', 'AcceptTypes', [ 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif' ])
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a New Picture Lands
    // ------------------------------------------------------------
    function Na__LeImgCfg__Placement() {
        return {
            widthFraction : Math.max(0.05, Math.min(1, Na__LeImgCfg__Value('Placement', 'InsertWidthFraction', 0.4))),
            minSizeMm     : Math.max(1, Na__LeImgCfg__Value('Placement', 'MinSizeMm', 5)),
            cascadeMm     : Math.max(0, Na__LeImgCfg__Value('Placement', 'CascadeMm', 8)),
            layerName     : Na__LeImgCfg__Value('Placement', 'LayerName', 'Images')
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Frame and Its Shadow
    // ------------------------------------------------------------
    function Na__LeImgCfg__Frame() {
        return {
            byDefault     : Na__LeImgCfg__Value('Frame', 'Default', true),
            colour        : Na__LeImgCfg__Value('Frame', 'Colour', '#555041'),
            widthMm       : Math.max(0.05, Na__LeImgCfg__Value('Frame', 'WidthPt', 1.5)) * (25.4 / 72),
            shadow        : Na__LeImgCfg__Value('Frame', 'Shadow', true),
            shadowColour  : Na__LeImgCfg__Value('Frame', 'ShadowColour', '#1f1d18'),
            shadowOpacity : Math.max(0, Math.min(1, Na__LeImgCfg__Value('Frame', 'ShadowOpacity', 0.3))),
            shadowBlurMm  : Math.max(0.05, Na__LeImgCfg__Value('Frame', 'ShadowBlurMm', 1.6)),
            shadowOffsetXMm : Na__LeImgCfg__Value('Frame', 'ShadowOffsetXMm', 0),
            shadowOffsetYMm : Na__LeImgCfg__Value('Frame', 'ShadowOffsetYMm', 0.9)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Crop, the PDF and the Sources
    // ------------------------------------------------------------
    function Na__LeImgCfg__Crop() {
        return { minSpan : Math.max(0.005, Math.min(0.5, Na__LeImgCfg__Value('Crop', 'MinSpan', 0.04))) };
    }
    function Na__LeImgCfg__Pdf() {
        return {
            maxDpi      : Math.max(72, Na__LeImgCfg__Value('Pdf', 'MaxDpi', 300)),
            jpegQuality : Math.max(0.5, Math.min(1, Na__LeImgCfg__Value('Pdf', 'JpegQuality', 0.95)))
        };
    }
    function Na__LeImgCfg__Sources() {
        return {
            pagesBaseUrl : Na__LeImgCfg__Value('Sources', 'PagesBaseUrl', 'https://www.noble-architecture.com').replace(/\/+$/, ''),
            timeoutMs    : Math.max(2000, Na__LeImgCfg__Value('Sources', 'TimeoutMs', 20000))
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images Setup API
    // ------------------------------------------------------------
    export {
        Na__LeImgCfg__Ready,
        Na__LeImgCfg__Value,
        Na__LeImgCfg__Label,
        Na__LeImgCfg__Storage,
        Na__LeImgCfg__Placement,
        Na__LeImgCfg__Frame,
        Na__LeImgCfg__Crop,
        Na__LeImgCfg__Pdf,
        Na__LeImgCfg__Sources
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
