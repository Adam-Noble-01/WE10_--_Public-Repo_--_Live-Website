// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - ENHANCE WHITECARD
// =============================================================================
//
// FILE       : Na__LayoutEditor__Enhance__.js
// NAMESPACE  : Na__LeEnhance
// MODULE     : Layout Editor - Enhance Whitecard
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The levels and high-pass sharpen pass from the image export, tuned for sheet viewports so the whitecard greys print white
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - Runs on the rendered raster of a viewport (the 2D underlay or the 3D
//   snapshot) before it is stored or drawn, when the viewport's Enhance
//   Whitecard style is on.
// - Reuses the two strip-based effects the image export ships (levels
//   through a lookup table, high-pass sharpen through canvas filters) with
//   this module's own parameters: a white point low enough that the
//   shaded whitecard faces go to paper white, then a light sharpen so the
//   edges stay crisp at print size.
//
// INTEGRATION:
// - Na__LayoutEditor__SnapshotRenderer__ calls Apply on the render canvas;
//   the cache keys carry the style flag so a toggle re-renders.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Enhance__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and the Export Effects
    // ------------------------------------------------------------
    import { Na__LeCfg__GetEnhanceSetup } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__PostProcess__ApplyLevels } from '../30__System__ImageExport/Na__ImageExport__PostProcessEffects__Levels.js';
    import { Na__PostProcess__ApplyHighPassSharpen } from '../30__System__ImageExport/Na__ImageExport__PostProcessEffects__HighPassSharpen.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Apply the Pass to a Canvas in Place
    // ------------------------------------------------------------
    // Resolves to the same canvas. A canvas without a 2D context (or a
    // browser without canvas filters) comes back unchanged from the effects
    // themselves.
    // ------------------------------------------------------------
    async function Na__LeEnhance__Apply(canvas) {
        if (!canvas) return canvas;
        const setup = Na__LeCfg__GetEnhanceSetup();
        try {
            await Na__PostProcess__ApplyLevels(canvas, [ {
                ImageExport__PostProcessEffects__Levels__Parameter__Black : setup.levelsBlack,
                ImageExport__PostProcessEffects__Levels__Parameter__White : setup.levelsWhite,
                ImageExport__PostProcessEffects__Levels__Parameter__Gamma : setup.levelsGamma
            } ]);
            if (setup.sharpenEnabled) {
                await Na__PostProcess__ApplyHighPassSharpen(canvas, [ {
                    ImageExport__PostProcessEffects__HighPassSharpen__Parameter__Radius    : setup.sharpenRadius,
                    ImageExport__PostProcessEffects__HighPassSharpen__Parameter__BlendMode : setup.sharpenBlendMode,
                    ImageExport__PostProcessEffects__HighPassSharpen__Parameter__Opacity   : setup.sharpenOpacity
                } ]);
            }
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] Enhance Whitecard pass failed; the plain render is used:', error);
        }
        return canvas;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Enhance API
    // ------------------------------------------------------------
    export {
        Na__LeEnhance__Apply
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
