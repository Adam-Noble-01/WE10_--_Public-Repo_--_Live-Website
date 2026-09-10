// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - CONFIG ACCESS
// =============================================================================
//
// FILE       : Na__ProjectedLinework__ConfigAccess__.js
// NAMESPACE  : Na__PlCfg
// MODULE     : Projected Linework - Config Access
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the projection config fetch and expose every tuned value to the engine
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Fetches Na__ProjectedLinework__AppConfig__.json exactly once and answers
//   every setting the projection engine, the overlay, the persistence layer
//   and the Dev menu ask for. Na__AppConfig__Main.json overrides the default
//   exclusion tokens (Appendix C of the plan), nothing else.
// - The fallbacks below mirror the shipped JSON so a failed fetch degrades to a
//   working projection rather than a broken one, except that the master switch
//   falls back to OFF: an overlay that starts expensive work with numbers
//   nobody chose is worse than no overlay.
// - The Dev menu can change a value for the session through Set; the pipeline
//   drops its caches when that happens.
//
// INTEGRATION:
// - index.html calls SetAppConfig then Ready before the pipeline initialises.
// - Every other module in this folder reads through the getters.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__ConfigAccess__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Key Shape
    // ------------------------------------------------------------
    const Na__PlCfg__ConfigUrl  = new URL('./Na__ProjectedLinework__AppConfig__.json', import.meta.url);
    const Na__PlCfg__PREFIX     = 'ProjectedLinework__';
    const Na__PlCfg__MAIN_BLOCK = 'ProjectedLinework__Config';                // <-- In Na__AppConfig__Main.json
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallback Values (mirror the shipped JSON, master switch off)
    // ------------------------------------------------------------
    const Na__PlCfg__FALLBACKS = Object.freeze({
        enabled                 : false,
        realtime                : true,
        realtimeDebounceMs      : 220,
        repaintFromCache        : true,
        logTimings              : true,
        angleThresholdDegrees   : 50,
        includeIntersections    : true,
        intersectionMaxInstances : 400,
        intersectionMaxPairs     : 20000,
        intersectionSelfMaxTriangles : 60000,
        iterationTimeMs         : 30,
        minimumSegmentLengthMm  : 1.0,
        edgeLiftWorldUnits      : 0.000001,
        backend                 : 'cpu',
        maxWorkers              : 8,
        minimumEdgesForWorkers  : 8000,
        clipBvhMaxLeafSize      : 4,
        yieldEveryMs            : 64,
        cacheBoundsTrees        : true,
        bvhMaxLeafSize          : 1,
        maxCachedResults        : 24,
        maxTriangles            : 2500000,
        previewEnabled          : false,
        previewMaxPixels        : 2048,
        previewFillColour       : '#ffffff',
        previewLineColour       : 'rgb(60, 60, 60)',
        previewOpacity          : 0.45,
        persistenceEnabled      : true,
        bakeOnSave              : true,
        maxSegmentsPerView      : 250000,
        assetFolder             : 'LayoutEditor/Linework',
        cacheInBrowser          : true,
        exclusionTokens         : ['Planting', 'Trees', 'People', 'Vehicles', 'Furniture', 'Decor'],
        skipObjectNames         : ['OrbitHelperCube', 'Na__GridLine', 'Na__FogPlane', 'Na__Billboard', 'Na__ElevGizmo', 'DrawingCut__'],
        buildToken              : '2026-09-09-phase4-initial',
        transparentOccludes     : false,
        transparentOpacityBelow : 0.999,
        appearance              : {
            visible  : { StrokeColour : '#323232', StrokeWidthMm : 12, StrokeOpacity : 1 },
            hidden   : { StrokeColour : '#6a6a6a', StrokeWidthMm : 8,  StrokeOpacity : 0.9, DashMm : 120 },
            authored : { StrokeColour : '#323232', StrokeWidthMm : 12, StrokeOpacity : 1 },
            section  : { StrokeColour : '#505050', StrokeWidthMm : 28, StrokeOpacity : 1 }
        }
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Parsed Configs and Fetch Promise
    // ------------------------------------------------------------
    let Na__PlCfg__Config      = null;   // <-- Parsed system JSON (null until the fetch settles)
    let Na__PlCfg__AppConfig   = null;   // <-- Na__AppConfig__Main.json object (overrides)
    let Na__PlCfg__LoadPromise = null;   // <-- In-flight fetch, so it happens exactly once
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Config Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Value From a Block (undefined when absent)
    // ------------------------------------------------------------
    // Block 'Render' and key 'Realtime' read
    // ProjectedLinework__Render__Config.ProjectedLinework__Render__Realtime.
    // ------------------------------------------------------------
    function Na__PlCfg__Val(blockName, keyName, fallback) {
        const block = Na__PlCfg__Config ? Na__PlCfg__Config[Na__PlCfg__PREFIX + blockName + '__Config'] : null;
        const value = block ? block[Na__PlCfg__PREFIX + blockName + '__' + keyName] : undefined;
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Finite Number, or the Fallback
    // ------------------------------------------------------------
    function Na__PlCfg__Num(blockName, keyName, fallback) {
        const value = Na__PlCfg__Val(blockName, keyName, undefined);
        return (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch the System JSON Once
    // ------------------------------------------------------------
    async function Na__PlCfg__Fetch() {
        try {
            const response = await fetch(Na__PlCfg__ConfigUrl, { cache : 'no-store' });   // <-- A stale copy is how an edit appears not to work
            if (!response.ok) {
                console.warn('[TrueVision3D ProjectedLinework] Config fetch failed (' + response.status + ') - the overlay stays off.');
                return false;
            }
            Na__PlCfg__Config = await response.json();
            return true;
        } catch (error) {
            console.warn('[TrueVision3D ProjectedLinework] Config unreadable - the overlay stays off.', error);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Loading
// -----------------------------------------------------------------------------

    // FUNCTION | Hand the Main App Config In (overrides)
    // ------------------------------------------------------------
    function Na__PlCfg__SetAppConfig(appConfig) {
        Na__PlCfg__AppConfig = (appConfig && typeof appConfig === 'object') ? appConfig : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the System Config Exactly Once
    // ------------------------------------------------------------
    function Na__PlCfg__Ready() {
        if (!Na__PlCfg__LoadPromise) Na__PlCfg__LoadPromise = Na__PlCfg__Fetch();
        return Na__PlCfg__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether the Projection Is Switched On At All
    // ------------------------------------------------------------
    function Na__PlCfg__IsEnabled() {
        if (!Na__PlCfg__Config) return Na__PlCfg__FALLBACKS.enabled;
        return Na__PlCfg__Config[Na__PlCfg__PREFIX + 'Enabled'] !== false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change One Value for the Session (Dev menu and console)
    // ------------------------------------------------------------
    function Na__PlCfg__Set(blockName, keyName, value) {
        if (!Na__PlCfg__Config) Na__PlCfg__Config = {};
        const blockKey = Na__PlCfg__PREFIX + blockName + '__Config';
        if (!Na__PlCfg__Config[blockKey]) Na__PlCfg__Config[blockKey] = {};
        Na__PlCfg__Config[blockKey][Na__PlCfg__PREFIX + blockName + '__' + keyName] = value;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch the Whole Feature for the Session
    // ------------------------------------------------------------
    function Na__PlCfg__SetEnabled(enabled) {
        if (!Na__PlCfg__Config) Na__PlCfg__Config = {};
        Na__PlCfg__Config[Na__PlCfg__PREFIX + 'Enabled'] = (enabled !== false);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Setup Blocks
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Realtime Render Setup
    // ------------------------------------------------------------
    function Na__PlCfg__GetRenderSetup() {
        const F = Na__PlCfg__FALLBACKS;
        return {
            realtime           : Na__PlCfg__Val('Render', 'Realtime', F.realtime) !== false,
            realtimeDebounceMs : Na__PlCfg__Num('Render', 'RealtimeDebounceMs', F.realtimeDebounceMs),
            repaintFromCache   : Na__PlCfg__Val('Render', 'RepaintFromCacheOnRedraw', F.repaintFromCache) !== false,
            logTimings         : Na__PlCfg__Val('Render', 'LogTimings', F.logTimings) === true
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Projection Setup (what counts as a line)
    // ------------------------------------------------------------
    function Na__PlCfg__GetProjectionSetup() {
        const F = Na__PlCfg__FALLBACKS;
        return {
            angleThresholdDegrees    : Na__PlCfg__Num('Projection', 'AngleThresholdDegrees',    F.angleThresholdDegrees),
            includeIntersectionEdges : Na__PlCfg__Val('Projection', 'IncludeIntersectionEdges', F.includeIntersections) === true,
            intersectionMaxInstances : Na__PlCfg__Num('Projection', 'IntersectionMaxInstances',     F.intersectionMaxInstances),
            intersectionMaxPairs     : Na__PlCfg__Num('Projection', 'IntersectionMaxPairs',         F.intersectionMaxPairs),
            intersectionSelfMaxTriangles : Na__PlCfg__Num('Projection', 'IntersectionSelfMaxTriangles', F.intersectionSelfMaxTriangles),
            iterationTimeMs          : Na__PlCfg__Num('Projection', 'IterationTimeMs',          F.iterationTimeMs),
            minimumSegmentLengthMm   : Na__PlCfg__Num('Projection', 'MinimumSegmentLengthMm',   F.minimumSegmentLengthMm),
            edgeLiftWorldUnits       : Na__PlCfg__Num('Projection', 'EdgeLiftWorldUnits',       F.edgeLiftWorldUnits)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Performance Setup (who does the work)
    // ------------------------------------------------------------
    function Na__PlCfg__GetPerformanceSetup() {
        const F = Na__PlCfg__FALLBACKS;
        return {
            backend                : Na__PlCfg__Val('Performance', 'Backend',                      F.backend),
            maxWorkers             : Na__PlCfg__Num('Performance', 'MaxWorkers',                   F.maxWorkers),
            minimumEdgesForWorkers : Na__PlCfg__Num('Performance', 'MinimumEdgesForWorkers',       F.minimumEdgesForWorkers),
            clipBvhMaxLeafSize     : Na__PlCfg__Num('Performance', 'ClipBvhMaxLeafSize',           F.clipBvhMaxLeafSize),
            yieldEveryMs           : Na__PlCfg__Num('Performance', 'YieldEveryMs',                 F.yieldEveryMs),
            cacheBoundsTrees       : Na__PlCfg__Val('Performance', 'CacheBoundsTrees',             F.cacheBoundsTrees) !== false,
            bvhMaxLeafSize         : Na__PlCfg__Num('Performance', 'BvhMaxLeafSize',               F.bvhMaxLeafSize),
            maxCachedResults       : Na__PlCfg__Num('Performance', 'MaxCachedResults',             F.maxCachedResults),
            maxTriangles           : Na__PlCfg__Num('Performance', 'MaxTrianglesForExactLinework', F.maxTriangles)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Provisional Preview Setup
    // ------------------------------------------------------------
    function Na__PlCfg__GetPreviewSetup() {
        const F = Na__PlCfg__FALLBACKS;
        return {
            enabled    : Na__PlCfg__Val('Preview', 'Enabled',    F.previewEnabled) === true,
            maxPixels  : Na__PlCfg__Num('Preview', 'MaxPixels',  F.previewMaxPixels),
            fillColour : Na__PlCfg__Val('Preview', 'FillColour', F.previewFillColour),
            lineColour : Na__PlCfg__Val('Preview', 'LineColour', F.previewLineColour),
            opacity    : Na__PlCfg__Num('Preview', 'Opacity',    F.previewOpacity)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Persistence Setup (R2 assets and the browser cache)
    // ------------------------------------------------------------
    function Na__PlCfg__GetPersistenceSetup() {
        const F = Na__PlCfg__FALLBACKS;
        return {
            enabled            : Na__PlCfg__Val('Persistence', 'Enabled',            F.persistenceEnabled) !== false,
            bakeOnSave         : Na__PlCfg__Val('Persistence', 'BakeOnSave',         F.bakeOnSave) !== false,
            maxSegmentsPerView : Na__PlCfg__Num('Persistence', 'MaxSegmentsPerView', F.maxSegmentsPerView),
            assetFolder        : Na__PlCfg__Val('Persistence', 'AssetFolder',        F.assetFolder),
            cacheInBrowser     : Na__PlCfg__Val('Persistence', 'CacheInBrowser',     F.cacheInBrowser) !== false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Appearance Rule for One Line Class
    // ------------------------------------------------------------
    // className: 'visible' | 'hidden' | 'authored' | 'section'
    // ------------------------------------------------------------
    function Na__PlCfg__GetAppearance(className) {
        const fallback = Na__PlCfg__FALLBACKS.appearance[className] || Na__PlCfg__FALLBACKS.appearance.visible;
        const keyName  = className.charAt(0).toUpperCase() + className.slice(1);
        const rule     = Na__PlCfg__Val('Appearance', keyName, null);
        if (!rule || typeof rule !== 'object') return Object.assign({}, fallback);

        return {
            StrokeColour  : (typeof rule.StrokeColour === 'string') ? rule.StrokeColour : fallback.StrokeColour,
            StrokeWidthMm : Number.isFinite(rule.StrokeWidthMm) ? rule.StrokeWidthMm : fallback.StrokeWidthMm,
            StrokeOpacity : Number.isFinite(rule.StrokeOpacity) ? rule.StrokeOpacity : fallback.StrokeOpacity,
            DashMm        : Number.isFinite(rule.DashMm) ? rule.DashMm : (fallback.DashMm || 0)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Default Category Exclusion Tokens (Main.json wins)
    // ------------------------------------------------------------
    function Na__PlCfg__GetDefaultExclusionTokens() {
        const main = Na__PlCfg__AppConfig ? Na__PlCfg__AppConfig[Na__PlCfg__MAIN_BLOCK] : null;
        const over = main ? main['ProjectedLinework__Config__Exclusions__DefaultCategoryTokens'] : null;
        if (Array.isArray(over)) return over.slice();

        const sys = Na__PlCfg__Val('Exclusions', 'DefaultCategoryTokens', null);
        return Array.isArray(sys) ? sys.slice() : Na__PlCfg__FALLBACKS.exclusionTokens.slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Scene Helper Names Never Sampled
    // ------------------------------------------------------------
    function Na__PlCfg__GetSkipObjectNames() {
        const list = Na__PlCfg__Val('Exclusions', 'SkipObjectNames', null);
        return Array.isArray(list) ? list.slice() : Na__PlCfg__FALLBACKS.skipObjectNames.slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Model Sampling Setup
    // ------------------------------------------------------------
    function Na__PlCfg__GetModelSetup() {
        const F = Na__PlCfg__FALLBACKS;
        return {
            buildToken              : Na__PlCfg__Val('Model', 'BuildToken',              F.buildToken),
            transparentOccludes     : Na__PlCfg__Val('Model', 'TransparentOccludes',     F.transparentOccludes) === true,
            transparentOpacityBelow : Na__PlCfg__Num('Model', 'TransparentOpacityBelow', F.transparentOpacityBelow)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a Dev Menu Label
    // ------------------------------------------------------------
    function Na__PlCfg__GetLabel(keySuffix, fallback) {
        const value = Na__PlCfg__Val('Labels', keySuffix, undefined);
        return (typeof value === 'string') ? value : fallback;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Config Access API
    // ------------------------------------------------------------
    export {
        Na__PlCfg__SetAppConfig,
        Na__PlCfg__Ready,
        Na__PlCfg__IsEnabled,
        Na__PlCfg__Set,
        Na__PlCfg__SetEnabled,
        Na__PlCfg__GetRenderSetup,
        Na__PlCfg__GetProjectionSetup,
        Na__PlCfg__GetPerformanceSetup,
        Na__PlCfg__GetPreviewSetup,
        Na__PlCfg__GetPersistenceSetup,
        Na__PlCfg__GetAppearance,
        Na__PlCfg__GetDefaultExclusionTokens,
        Na__PlCfg__GetSkipObjectNames,
        Na__PlCfg__GetModelSetup,
        Na__PlCfg__GetLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
