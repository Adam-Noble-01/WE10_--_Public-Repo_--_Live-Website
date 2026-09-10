// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - CONFIG STATE
// =============================================================================
//
// FILE       : Na__DrawView__ConfigState__.js
// NAMESPACE  : Na__DrawCfg
// MODULE     : Drawing View Core - Config State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the drawing view config fetch and expose every tuned value to the presets and the adapter
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Fetches Na__DrawView__AppConfig__.json exactly once and exposes the render
//   preset, material preset, section cut appearance, flight timings and the
//   shared labels. Three sources, in order of precedence:
//     1. Na__AppConfig__Main.json (RenderEffect__ProfileLines Drawing2d keys
//        and the DrawingView__Config block), handed in by index.html
//     2. the system JSON beside this module
//     3. the built-in fallbacks below, which mirror the shipped JSON
//   so a failed fetch degrades to a correct drawing rather than a broken one.
// - THE SECTION APPEARANCE IS THE DOOUS LOOK. The dark grey poche and profile
//   (#505050 at 2 px) that the Doous project's section scenes use reads better
//   than the tool's light default, so every plan cut and every section drawing
//   starts from it. The live Cross Sections tool keeps its own colours; the
//   adapter restores them when the drawing closes.
// - Pure config. No DOM, no Three.js objects, no project data.
//
// INTEGRATION:
// - index.html calls SetAppConfig then Load before the presets initialise.
// - Na__DrawView__ComposerPreset__, Na__DrawView__MaterialPreset__ and
//   Na__DrawView__SectionAdapter__ read through the getters.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 42__System__DrawingViewCore/Na__DrawView__ConfigState__.js 1.0.0
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase B)
// - Parity        : verbatim
// - Divergences   : Console prefix and header only. The RenderEffect__ProfileLines Drawing2d
//                   keys this reads already exist in TrueVision's main config, added by
//                   v2.19.0, so the override chain lands unchanged.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 3. Takes over the config reading
//   the composer preset and material preset carried themselves in Phase 2 and
//   adds the section appearance the adapter applies.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Block Keys
    // ------------------------------------------------------------
    const Na__DrawCfg__ConfigUrl      = new URL('./Na__DrawView__AppConfig__.json', import.meta.url);
    const Na__DrawCfg__RENDER_BLOCK   = 'DrawingView__Render__Config';
    const Na__DrawCfg__MATERIAL_BLOCK = 'DrawingView__Materials__Config';
    const Na__DrawCfg__SECTION_BLOCK  = 'DrawingView__Section__Config';
    const Na__DrawCfg__TRANS_BLOCK    = 'DrawingView__Transition__Config';
    const Na__DrawCfg__LABELS_BLOCK   = 'DrawingView__Labels__Config';
    const Na__DrawCfg__MAIN_BLOCK     = 'DrawingView__Config';               // <-- In Na__AppConfig__Main.json
    const Na__DrawCfg__MAIN_LINES     = 'RenderEffect__ProfileLines';        // <-- Drawing2d keys ride in the 3D block
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallback Values (mirror the shipped JSON exactly)
    // ------------------------------------------------------------
    const Na__DrawCfg__FALLBACKS = Object.freeze({
        backgroundColour    : '#ffffff',
        edgeWidth           : 1.0,
        edgeColour          : null,
        edgeThresholdNormal : null,
        profileEnabled      : true,
        disableFog          : true,
        disableAo           : true,
        opaqueGlassColour   : '#ffffff',
        whitecardColour     : '#ffffff',
        roughness           : 1.0,
        metalness           : 0.0,
        polygonOffsetFactor : 2,
        polygonOffsetUnits  : 2,
        sectionFillColour   : '#505050',                                     // <-- The Doous poche
        sectionLineColour   : '#505050',
        sectionLineWidthPx  : 2,
        planeNamePrefix     : 'DrawingCut__',
        intoMs              : 1400,
        outOfMs             : 1400,
        easing              : 'easeInOutCubic'
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Parsed Configs and Fetch Promise
    // ------------------------------------------------------------
    let Na__DrawCfg__Config      = null;   // <-- Parsed system JSON (null until the fetch settles)
    let Na__DrawCfg__AppConfig   = null;   // <-- Na__AppConfig__Main.json object (overrides)
    let Na__DrawCfg__LoadPromise = null;   // <-- In-flight fetch, so it happens exactly once
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Config Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One System Config Value (undefined when absent)
    // ------------------------------------------------------------
    function Na__DrawCfg__Sys(blockKey, valueKey) {
        if (!Na__DrawCfg__Config) return undefined;
        const block = Na__DrawCfg__Config[blockKey];
        if (!block || typeof block !== 'object') return undefined;
        return block[valueKey];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read One Main Config Value (undefined when absent)
    // ------------------------------------------------------------
    function Na__DrawCfg__Main(blockKey, valueKey) {
        if (!Na__DrawCfg__AppConfig) return undefined;
        const block = Na__DrawCfg__AppConfig[blockKey];
        if (!block || typeof block !== 'object') return undefined;
        return block[valueKey];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | First Defined, Non-Null Value in Precedence Order
    // ------------------------------------------------------------
    // null is meaningful for the edge colour and threshold (it means "use the
    // 3D value"), so only undefined and null fall through to the next source
    // and a null FALLBACK is returned as null.
    // ------------------------------------------------------------
    function Na__DrawCfg__Pick(mainValue, sysValue, fallback) {
        if (mainValue !== undefined && mainValue !== null) return mainValue;
        if (sysValue  !== undefined && sysValue  !== null) return sysValue;
        return fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Finite Number or the Fallback
    // ------------------------------------------------------------
    function Na__DrawCfg__Num(value, fallback) {
        return Number.isFinite(value) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch and Parse the System Config Once
    // ------------------------------------------------------------
    async function Na__DrawCfg__Fetch() {
        try {
            const response = await fetch(Na__DrawCfg__ConfigUrl);
            if (!response.ok) {
                console.warn('[TrueVision3D] Drawing view config fetch failed (' + response.status + ') - using built-in defaults.');
                return false;
            }
            Na__DrawCfg__Config = await response.json();
            return true;
        } catch (error) {
            console.warn('[TrueVision3D] Drawing view config unreadable - using built-in defaults.', error);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Loading
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Main App Config (the override source)
    // ------------------------------------------------------------
    function Na__DrawCfg__SetAppConfig(appConfig) {
        Na__DrawCfg__AppConfig = (appConfig && typeof appConfig === 'object') ? appConfig : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the System Config Exactly Once
    // ------------------------------------------------------------
    function Na__DrawCfg__Load() {
        if (!Na__DrawCfg__LoadPromise) Na__DrawCfg__LoadPromise = Na__DrawCfg__Fetch();
        return Na__DrawCfg__LoadPromise;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Setup Blocks
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Composer Preset Setup
    // ------------------------------------------------------------
    function Na__DrawCfg__GetRenderSetup() {
        const F = Na__DrawCfg__FALLBACKS;
        return {
            backgroundColour    : Na__DrawCfg__Pick(Na__DrawCfg__Main(Na__DrawCfg__MAIN_BLOCK, 'DrawingView__Config__BackgroundColour'),
                                                    Na__DrawCfg__Sys(Na__DrawCfg__RENDER_BLOCK, 'DrawingView__Render__BackgroundColour'), F.backgroundColour),
            edgeWidth           : Na__DrawCfg__Num(Na__DrawCfg__Pick(Na__DrawCfg__Main(Na__DrawCfg__MAIN_LINES, 'RenderEffect__ProfileLines__Drawing2dEdgeWidth'),
                                                    Na__DrawCfg__Sys(Na__DrawCfg__RENDER_BLOCK, 'DrawingView__Render__ProfileEdgeWidth'), F.edgeWidth), F.edgeWidth),
            edgeColour          : Na__DrawCfg__Pick(Na__DrawCfg__Main(Na__DrawCfg__MAIN_LINES, 'RenderEffect__ProfileLines__Drawing2dEdgeColor'),
                                                    Na__DrawCfg__Sys(Na__DrawCfg__RENDER_BLOCK, 'DrawingView__Render__ProfileEdgeColour'), F.edgeColour),
            edgeThresholdNormal : Na__DrawCfg__Pick(Na__DrawCfg__Main(Na__DrawCfg__MAIN_LINES, 'RenderEffect__ProfileLines__Drawing2dEdgeThresholdNormal'),
                                                    Na__DrawCfg__Sys(Na__DrawCfg__RENDER_BLOCK, 'DrawingView__Render__ProfileEdgeThresholdNormal'), F.edgeThresholdNormal),
            profileEnabled      : Na__DrawCfg__Main(Na__DrawCfg__MAIN_LINES, 'RenderEffect__ProfileLines__Drawing2dEnabled') !== false,
            disableFog          : Na__DrawCfg__Sys(Na__DrawCfg__RENDER_BLOCK, 'DrawingView__Render__DisableFog') !== false,
            disableAo           : Na__DrawCfg__Sys(Na__DrawCfg__RENDER_BLOCK, 'DrawingView__Render__DisableAmbientOcclusion') !== false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Material Preset Setup
    // ------------------------------------------------------------
    function Na__DrawCfg__GetMaterialSetup() {
        const F = Na__DrawCfg__FALLBACKS;
        const sys = (key) => Na__DrawCfg__Sys(Na__DrawCfg__MATERIAL_BLOCK, 'DrawingView__Materials__' + key);
        return {
            opaqueGlassColour   : Na__DrawCfg__Pick(undefined, sys('OpaqueGlassColour'), F.opaqueGlassColour),
            whitecardColour     : Na__DrawCfg__Pick(undefined, sys('WhitecardColour'),   F.whitecardColour),
            roughness           : Na__DrawCfg__Num(sys('Roughness'),           F.roughness),
            metalness           : Na__DrawCfg__Num(sys('Metalness'),           F.metalness),
            polygonOffsetFactor : Na__DrawCfg__Num(sys('PolygonOffsetFactor'), F.polygonOffsetFactor),
            polygonOffsetUnits  : Na__DrawCfg__Num(sys('PolygonOffsetUnits'),  F.polygonOffsetUnits)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Section Cut Appearance and Naming
    // ------------------------------------------------------------
    // Fill, line and width applied to the drawing cut by the section adapter.
    // Project-level overrides live in DrawingView__Config in the main config.
    // ------------------------------------------------------------
    function Na__DrawCfg__GetSectionSetup() {
        const F = Na__DrawCfg__FALLBACKS;
        return {
            fillColour      : Na__DrawCfg__Pick(Na__DrawCfg__Main(Na__DrawCfg__MAIN_BLOCK, 'DrawingView__Config__SectionFillColour'),
                                                Na__DrawCfg__Sys(Na__DrawCfg__SECTION_BLOCK, 'DrawingView__Section__FillColour'), F.sectionFillColour),
            lineColour      : Na__DrawCfg__Pick(Na__DrawCfg__Main(Na__DrawCfg__MAIN_BLOCK, 'DrawingView__Config__SectionLineColour'),
                                                Na__DrawCfg__Sys(Na__DrawCfg__SECTION_BLOCK, 'DrawingView__Section__LineColour'), F.sectionLineColour),
            lineWidthPx     : Na__DrawCfg__Num(Na__DrawCfg__Pick(Na__DrawCfg__Main(Na__DrawCfg__MAIN_BLOCK, 'DrawingView__Config__SectionLineWidthPx'),
                                                Na__DrawCfg__Sys(Na__DrawCfg__SECTION_BLOCK, 'DrawingView__Section__LineWidthPx'), F.sectionLineWidthPx), F.sectionLineWidthPx),
            planeNamePrefix : Na__DrawCfg__Pick(undefined, Na__DrawCfg__Sys(Na__DrawCfg__SECTION_BLOCK, 'DrawingView__Section__PlaneNamePrefix'), F.planeNamePrefix)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Flight Timings Shared by Every Drawing Kind
    // ------------------------------------------------------------
    function Na__DrawCfg__GetTransitionSetup() {
        const F = Na__DrawCfg__FALLBACKS;
        return {
            intoMs  : Na__DrawCfg__Num(Na__DrawCfg__Pick(Na__DrawCfg__Main(Na__DrawCfg__MAIN_BLOCK, 'DrawingView__Config__TransitionIntoMs'),
                                        Na__DrawCfg__Sys(Na__DrawCfg__TRANS_BLOCK, 'DrawingView__Transition__IntoMs'), F.intoMs), F.intoMs),
            outOfMs : Na__DrawCfg__Num(Na__DrawCfg__Pick(Na__DrawCfg__Main(Na__DrawCfg__MAIN_BLOCK, 'DrawingView__Config__TransitionOutOfMs'),
                                        Na__DrawCfg__Sys(Na__DrawCfg__TRANS_BLOCK, 'DrawingView__Transition__OutOfMs'), F.outOfMs), F.outOfMs),
            easing  : Na__DrawCfg__Pick(undefined, Na__DrawCfg__Sys(Na__DrawCfg__TRANS_BLOCK, 'DrawingView__Transition__Easing'), F.easing)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get One Shared Label by Key Suffix
    // ------------------------------------------------------------
    function Na__DrawCfg__GetLabel(keySuffix, fallback) {
        const value = Na__DrawCfg__Sys(Na__DrawCfg__LABELS_BLOCK, 'DrawingView__Labels__' + keySuffix);
        return (typeof value === 'string') ? value : fallback;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing View Config State API
    // ------------------------------------------------------------
    export {
        Na__DrawCfg__SetAppConfig,
        Na__DrawCfg__Load,
        Na__DrawCfg__GetRenderSetup,
        Na__DrawCfg__GetMaterialSetup,
        Na__DrawCfg__GetSectionSetup,
        Na__DrawCfg__GetTransitionSetup,
        Na__DrawCfg__GetLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
