// =============================================================================
// TRUEVISION3D - ELEVATION DEPTH FOG - CONFIG STATE
// =============================================================================
//
// FILE       : Na__ElevationDepthFog__ConfigState__.js
// NAMESPACE  : Na__ElevFogCfg
// MODULE     : Elevation Depth Fog - Config State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Load the Elevation Depth Fog config once and hand it out as typed getters
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - One fetch of Na__ElevationDepthFog__AppConfig__.json, resolved beside this
//   file, and getters that flatten the config's verbose key names so no
//   consumer has to know them.
// - EVERY GETTER HAS A FALLBACK THAT MIRRORS THE SHIPPED JSON. A drawing
//   record is normalised the first time it is read, which is during the
//   project load and well before this fetch has settled, and a stale cached
//   config can lack a key added later. Either way a record is given the
//   shipped defaults rather than a broken block - and because the two agree,
//   a record normalised before the fetch is not rewritten after it.
// - Millimetres throughout. The render layer converts to scene units itself,
//   at the moment it draws.
//
// INTEGRATION:
// - Every other module in 49__System__ElevationDepthFog reads through here.
// - Na__ElevFog__Initialise starts the load.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Depth Fog build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Block Keys
    // ------------------------------------------------------------
    const Na__ElevFogCfg__ConfigUrl      = new URL('./Na__ElevationDepthFog__AppConfig__.json', import.meta.url);
    const Na__ElevFogCfg__DEFAULTS_BLOCK = 'ElevationDepthFog__Defaults__Config';
    const Na__ElevFogCfg__LIMITS_BLOCK   = 'ElevationDepthFog__Limits__Config';
    const Na__ElevFogCfg__LOOK_BLOCK     = 'ElevationDepthFog__Appearance__Config';
    const Na__ElevFogCfg__LABELS_BLOCK   = 'ElevationDepthFog__Labels__Config';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallback Values (mirror the shipped JSON exactly)
    // ------------------------------------------------------------
    const Na__ElevFogCfg__FALLBACKS = Object.freeze({
        defaultEnabled     : false,
        defaultStartMm     : 1000,
        defaultEndMm       : 15000,
        defaultFalloff     : 50,
        maxDepthMm         : 200000,
        minBandMm          : 100,
        depthStepMm        : 250,
        falloffStepPercent : 5,
        falloffEdgePercent : 0.5,
        colour             : '#ffffff',
        maxOpacity         : 1,
        edgeGuardPx        : 1,
        emptyReachPx       : 12
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Parsed Config and Fetch Promise
    // ------------------------------------------------------------
    let Na__ElevFogCfg__Config      = null;   // <-- Parsed JSON (null until the fetch settles)
    let Na__ElevFogCfg__LoadPromise = null;   // <-- In-flight fetch, so it happens exactly once
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Config Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__ElevFogCfg__Val(blockKey, valueKey, fallback) {
        if (!Na__ElevFogCfg__Config) return fallback;
        const block = Na__ElevFogCfg__Config[blockKey];
        if (!block || typeof block !== 'object') return fallback;
        const value = block[valueKey];
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Numeric Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__ElevFogCfg__Num(blockKey, valueKey, fallback) {
        const value = Na__ElevFogCfg__Val(blockKey, valueKey, fallback);
        return Number.isFinite(value) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch and Parse the Config File Once
    // ------------------------------------------------------------
    async function Na__ElevFogCfg__Fetch() {
        try {
            const response = await fetch(Na__ElevFogCfg__ConfigUrl);
            if (!response.ok) {
                console.warn('[TrueVision3D] Elevation depth fog config fetch failed (' + response.status + ') - using built-in defaults.');
                return true;                                                     // <-- The defaults ARE the shipped config: still usable
            }
            Na__ElevFogCfg__Config = await response.json();
            return Na__ElevFogCfg__IsEnabled();
        } catch (error) {
            console.warn('[TrueVision3D] Elevation depth fog config unreadable - using built-in defaults.', error);
            return true;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Loading and Feature Gate
// -----------------------------------------------------------------------------

    // FUNCTION | Load the Config Exactly Once
    // ------------------------------------------------------------
    function Na__ElevFogCfg__Load() {
        if (!Na__ElevFogCfg__LoadPromise) Na__ElevFogCfg__LoadPromise = Na__ElevFogCfg__Fetch();
        return Na__ElevFogCfg__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Elevation Depth Fog Effect Switched On at All?
    // ------------------------------------------------------------
    // The whole system's switch, not a drawing's. False draws no fog anywhere
    // and builds no Fog block in any row; every record keeps what it holds.
    // True until a config that loaded says otherwise.
    // ------------------------------------------------------------
    function Na__ElevFogCfg__IsEnabled() {
        if (!Na__ElevFogCfg__Config) return true;
        return Na__ElevFogCfg__Config.ElevationDepthFog__Enabled !== false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Defaults, Limits, Appearance and Labels
// -----------------------------------------------------------------------------

    // FUNCTION | What a Drawing's Fog Block Holds Before Anybody Touches It
    // ------------------------------------------------------------
    // Shaped as Na__ElevFogMath__NormaliseSettings wants its defaults.
    // ------------------------------------------------------------
    function Na__ElevFogCfg__GetDefaults() {
        const D = Na__ElevFogCfg__DEFAULTS_BLOCK;
        const F = Na__ElevFogCfg__FALLBACKS;
        return {
            enabled        : Na__ElevFogCfg__Val(D, 'ElevationDepthFog__Defaults__Enabled', F.defaultEnabled) === true,
            startDepthMm   : Na__ElevFogCfg__Num(D, 'ElevationDepthFog__Defaults__StartDepthMm',   F.defaultStartMm),
            endDepthMm     : Na__ElevFogCfg__Num(D, 'ElevationDepthFog__Defaults__EndDepthMm',     F.defaultEndMm),
            falloffPercent : Na__ElevFogCfg__Num(D, 'ElevationDepthFog__Defaults__FalloffPercent', F.defaultFalloff)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Range of the Three Boxes
    // ------------------------------------------------------------
    // Shaped as Na__ElevFogMath__NormaliseSettings wants its limits, with the
    // two steps the row's inputs move by alongside.
    // ------------------------------------------------------------
    function Na__ElevFogCfg__GetLimits() {
        const L = Na__ElevFogCfg__LIMITS_BLOCK;
        const F = Na__ElevFogCfg__FALLBACKS;
        return {
            maxDepthMm         : Na__ElevFogCfg__Num(L, 'ElevationDepthFog__Limits__MaxDepthMm',         F.maxDepthMm),
            minBandMm          : Na__ElevFogCfg__Num(L, 'ElevationDepthFog__Limits__MinBandMm',          F.minBandMm),
            depthStepMm        : Na__ElevFogCfg__Num(L, 'ElevationDepthFog__Limits__DepthStepMm',        F.depthStepMm),
            falloffStepPercent : Na__ElevFogCfg__Num(L, 'ElevationDepthFog__Limits__FalloffStepPercent', F.falloffStepPercent),
            falloffEdgePercent : Na__ElevFogCfg__Num(L, 'ElevationDepthFog__Limits__FalloffEdgePercent', F.falloffEdgePercent)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Fog Looks Like
    // ------------------------------------------------------------
    function Na__ElevFogCfg__GetAppearance() {
        const A = Na__ElevFogCfg__LOOK_BLOCK;
        const F = Na__ElevFogCfg__FALLBACKS;
        return {
            colour      : String(Na__ElevFogCfg__Val(A, 'ElevationDepthFog__Appearance__Colour', F.colour)),
            maxOpacity   : Math.min(1, Math.max(0, Na__ElevFogCfg__Num(A, 'ElevationDepthFog__Appearance__MaxOpacity', F.maxOpacity))),
            edgeGuardPx  : Math.max(0, Na__ElevFogCfg__Num(A, 'ElevationDepthFog__Appearance__EdgeGuardPx', F.edgeGuardPx)),
            emptyReachPx : Math.max(0, Na__ElevFogCfg__Num(A, 'ElevationDepthFog__Appearance__EmptyReachPx', F.emptyReachPx))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a User-Facing Label
    // ------------------------------------------------------------
    // shortKey is the key's tail: 'Caption' reads ElevationDepthFog__Labels__Caption.
    // ------------------------------------------------------------
    function Na__ElevFogCfg__GetLabel(shortKey, fallback) {
        const value = Na__ElevFogCfg__Val(Na__ElevFogCfg__LABELS_BLOCK, 'ElevationDepthFog__Labels__' + shortKey, fallback);
        return (typeof value === 'string' && value.length > 0) ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a Label With {token} Placeholders Filled In
    // ------------------------------------------------------------
    function Na__ElevFogCfg__FormatLabel(shortKey, fallback, tokens) {
        let text = Na__ElevFogCfg__GetLabel(shortKey, fallback);
        Object.keys(tokens || {}).forEach((name) => {
            text = text.split('{' + name + '}').join(String(tokens[name]));
        });
        return text;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Depth Fog Config API
    // ------------------------------------------------------------
    export {
        Na__ElevFogCfg__Load,
        Na__ElevFogCfg__IsEnabled,
        Na__ElevFogCfg__GetDefaults,
        Na__ElevFogCfg__GetLimits,
        Na__ElevFogCfg__GetAppearance,
        Na__ElevFogCfg__GetLabel,
        Na__ElevFogCfg__FormatLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
