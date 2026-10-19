// =============================================================================
// TRUEVISION3D - POINT CLOUD DATA - CONFIG
// =============================================================================
//
// FILE       : Na__PointCloud__Config__.js
// NAMESPACE  : Na__PcCfg
// MODULE     : Point Cloud Data - Config
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The point cloud viewports' settings: alignment tolerances, preview sharpness and the datum symbol
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - Reads Na__LayoutEditor__PointCloud__Config__.json beside it once. THE
//   FALLBACK IS THE SHIPPED FILE: a viewport must be able to paint before the
//   fetch resolves, so every number below matches the file, and the file wins
//   the moment it lands (the site plan composites' pattern).
// - Every reader returns plain numbers, clamped to sane ranges, never the raw
//   JSON, so a hand edit with a typo degrades to the fallback rather than
//   drawing a point cloud a kilometre away.
//
// INTEGRATION:
// - Read by Na__LayoutEditor__Viewport2d__PointCloud__ and
//   Na__LayoutEditor__Panel__PointCloudTools__.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.1.0
// - Perspective: how far a 3D viewport's scene camera may stand and look
//   from a 3D View export's camera before the export is refused
//   (TrueVision3D v2.178.0).
//
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (point cloud viewports).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and the Built-in Fallback
    // ------------------------------------------------------------
    const Na__PcCfg__ConfigUrl = new URL('./Na__LayoutEditor__PointCloud__Config__.json', import.meta.url);

    const Na__PcCfg__FALLBACK = {
        alignment : { quietDeg : 0.05, toleranceDeg : 1.0 },
        perspective : { positionMm : 5, angleDeg : 0.1, fovDeg : 1.0 },
        display   : { defaultOpacity : 0.65, previewSlack : 0.85, tileMarginPx : 64 },
        datum     : { symbolMm : 5, crossOverhang : 0.6, strokeMm : 0.25, colourHex : '#C81E1E' }
    };
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Loaded Config
    // ------------------------------------------------------------
    let Na__PcCfg__Config      = null;
    let Na__PcCfg__LoadPromise = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading and Reading
// -----------------------------------------------------------------------------

    // FUNCTION | Load the Config Once (resolves whether or not the file is there)
    // ------------------------------------------------------------
    function Na__PcCfg__Ready() {
        if (!Na__PcCfg__LoadPromise) {
            Na__PcCfg__LoadPromise = (async () => {
                try {
                    const response = await fetch(Na__PcCfg__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) {
                        console.warn('[TrueVision3D LayoutEditor] Point cloud config fetch failed (' + response.status + '); the built-in values are used.');
                        return null;
                    }
                    Na__PcCfg__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Point cloud config unavailable; the built-in values are used.', error);
                }
                return Na__PcCfg__Config;
            })();
        }
        return Na__PcCfg__LoadPromise;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Number From a Block, Clamped, Else the Fallback
    // ------------------------------------------------------------
    function Na__PcCfg__Num(blockName, key, fallback, min, max) {
        const config = Na__PcCfg__Config;
        const block  = (config && typeof config === 'object' && config['LayoutEditor__PointCloud__' + blockName]) || null;
        const value  = block ? block[key] : undefined;
        if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
        return Math.min(max, Math.max(min, value));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Alignment Tolerances { quietDeg, toleranceDeg }
    // ------------------------------------------------------------
    function Na__PcCfg__Alignment() {
        const fb = Na__PcCfg__FALLBACK.alignment;
        const quiet = Na__PcCfg__Num('Alignment', 'QuietDeg', fb.quietDeg, 0, 5);
        return { quietDeg : quiet, toleranceDeg : Math.max(quiet, Na__PcCfg__Num('Alignment', 'ToleranceDeg', fb.toleranceDeg, 0, 10)) };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Perspective Tolerances { positionMm, angleDeg, fovDeg }
    // ------------------------------------------------------------
    function Na__PcCfg__Perspective() {
        const fb = Na__PcCfg__FALLBACK.perspective;
        return {
            positionMm : Na__PcCfg__Num('Perspective', 'PositionToleranceMm', fb.positionMm, 0, 1000),
            angleDeg   : Na__PcCfg__Num('Perspective', 'AngleToleranceDeg', fb.angleDeg, 0, 5),
            fovDeg     : Na__PcCfg__Num('Perspective', 'FovToleranceDeg', fb.fovDeg, 0, 20)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Display Settings { defaultOpacity, previewSlack, tileMarginPx }
    // ------------------------------------------------------------
    function Na__PcCfg__Display() {
        const fb = Na__PcCfg__FALLBACK.display;
        return {
            defaultOpacity : Na__PcCfg__Num('Display', 'DefaultOpacity', fb.defaultOpacity, 0.05, 1),
            previewSlack   : Na__PcCfg__Num('Display', 'PreviewSlack', fb.previewSlack, 0.25, 4),
            tileMarginPx   : Na__PcCfg__Num('Display', 'TileMarginPx', fb.tileMarginPx, 0, 1024)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Datum Symbol { symbolMm, crossOverhang, strokeMm, colourHex }
    // ------------------------------------------------------------
    function Na__PcCfg__Datum() {
        const fb     = Na__PcCfg__FALLBACK.datum;
        const block  = Na__PcCfg__Config ? Na__PcCfg__Config.LayoutEditor__PointCloud__Datum : null;
        const colour = (block && typeof block.ColourHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(block.ColourHex)) ? block.ColourHex : fb.colourHex;
        return {
            symbolMm      : Na__PcCfg__Num('Datum', 'SymbolMm', fb.symbolMm, 1, 20),
            crossOverhang : Na__PcCfg__Num('Datum', 'CrossOverhang', fb.crossOverhang, 0, 2),
            strokeMm      : Na__PcCfg__Num('Datum', 'StrokeMm', fb.strokeMm, 0.05, 1),
            colourHex     : colour
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Point Cloud Config API
    // ------------------------------------------------------------
    export {
        Na__PcCfg__Ready,
        Na__PcCfg__Alignment,
        Na__PcCfg__Perspective,
        Na__PcCfg__Display,
        Na__PcCfg__Datum
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
