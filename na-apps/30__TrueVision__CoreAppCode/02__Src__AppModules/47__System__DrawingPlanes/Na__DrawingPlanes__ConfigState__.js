// =============================================================================
// TRUEVISION3D - DRAWING PLANES - CONFIG STATE
// =============================================================================
//
// FILE       : Na__DrawingPlanes__ConfigState__.js
// NAMESPACE  : Na__PlaneCfg
// MODULE     : Drawing Planes - Config State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Load the Drawing Planes config once and hand it out as typed getters
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - One fetch of Na__DrawingPlanes__AppConfig__.json, resolved beside this
//   file, and getters that flatten the config's verbose key names so no
//   consumer has to know them.
// - EVERY GETTER HAS A FALLBACK THAT MIRRORS THE SHIPPED JSON. A plane is
//   shown the moment a toggle is pressed, which can be before the fetch has
//   settled, and a stale cached config can lack a key added later. Either way
//   the system draws the shipped plane rather than a broken one.
// - Millimetres in the JSON, scene units out wherever a getter says Units.
//
// INTEGRATION:
// - Every other module in 47__System__DrawingPlanes reads through here.
// - Na__PlaneOverlay__Initialize starts the load.
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
// - Initial implementation for the Drawing Planes build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Unit Conversion
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Block Keys
    // ------------------------------------------------------------
    const Na__PlaneCfg__ConfigUrl    = new URL('./Na__DrawingPlanes__AppConfig__.json', import.meta.url);
    const Na__PlaneCfg__SNAP_BLOCK   = 'DrawingPlanes__Snap__Config';
    const Na__PlaneCfg__BOUNDS_BLOCK = 'DrawingPlanes__Bounds__Config';
    const Na__PlaneCfg__LOOK_BLOCK   = 'DrawingPlanes__Appearance__Config';
    const Na__PlaneCfg__GRIP_BLOCK   = 'DrawingPlanes__Grip__Config';
    const Na__PlaneCfg__LABELS_BLOCK = 'DrawingPlanes__Labels__Config';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallback Values (mirror the shipped JSON exactly)
    // ------------------------------------------------------------
    const Na__PlaneCfg__FALLBACKS = Object.freeze({
        snapEnabled        : true,
        snapIncrementMm    : 50,
        snapIncrementsMm   : [10, 25, 50, 100, 250, 500],
        buildingTokens     : ['MainBuildingModel', 'Storey__'],
        groundTokens       : ['LandscapeEnvironment'],
        ignoreTokens       : ['OrbitHelperCube'],
        overshootMm        : 1500,
        overshootFraction  : 0.08,
        groundLiftMm       : 100,
        groundMinNormalY   : 0.5,
        minPlaneHeightMm   : 1000,
        fallbackHalfSpanMm : 10000,
        fallbackHeightMm   : 6000,
        palette            : ['#2e7d4f', '#1f6fd1', '#d9731a', '#7b3fb8', '#0e8f8a', '#c2277a', '#8a6d1c', '#c0392b'],
        planPaletteOffset  : 4,
        fillOpacity        : 0.07,
        fillOpacitySel     : 0.16,
        sectionFillBoost   : 0.05,
        outlinePx          : 2,
        outlineSelPx       : 3.5,
        ghostOpacity       : 0.22,
        padColour          : '#ffffff',
        padOpacity         : 0.88,
        gripFraction       : 0.045,
        gripMinMm          : 350,
        gripMaxMm          : 1100,
        arrowFraction      : 0.12,
        arrowMinMm         : 1000,
        arrowMaxMm         : 3000,
        labelUppercase     : true,
        labelMaxFraction   : 0.6,
        labelFont          : "600 64px 'Segoe UI', Arial, sans-serif",
        dragRecomputeMs    : 90,
        clickThresholdPx   : 4,
        minAxisAngleDeg    : 6,
        hoverCursor        : 'grab',
        dragCursor         : 'grabbing',
        pickCursor         : 'crosshair',
        floorMinNormalY    : 0.7
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Parsed Config and Fetch Promise
    // ------------------------------------------------------------
    let Na__PlaneCfg__Config      = null;   // <-- Parsed JSON (null until the fetch settles)
    let Na__PlaneCfg__LoadPromise = null;   // <-- In-flight fetch, so it happens exactly once
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Config Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__PlaneCfg__Val(blockKey, valueKey, fallback) {
        if (!Na__PlaneCfg__Config) return fallback;
        const block = Na__PlaneCfg__Config[blockKey];
        if (!block || typeof block !== 'object') return fallback;
        const value = block[valueKey];
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Numeric Config Value With a Fallback
    // ------------------------------------------------------------
    function Na__PlaneCfg__Num(blockKey, valueKey, fallback) {
        const value = Na__PlaneCfg__Val(blockKey, valueKey, fallback);
        return Number.isFinite(value) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a List of Non-Empty Strings With a Fallback
    // ------------------------------------------------------------
    // A malformed list falls back WHOLE. Half a token list would measure half
    // a building, which is worse than the shipped list.
    // ------------------------------------------------------------
    function Na__PlaneCfg__Strings(blockKey, valueKey, fallback) {
        const raw = Na__PlaneCfg__Val(blockKey, valueKey, null);
        if (!Array.isArray(raw)) return fallback.slice();
        const clean = raw.filter((entry) => typeof entry === 'string' && entry.length > 0);
        return clean.length > 0 ? clean : fallback.slice();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch and Parse the Config File Once
    // ------------------------------------------------------------
    async function Na__PlaneCfg__Fetch() {
        try {
            const response = await fetch(Na__PlaneCfg__ConfigUrl);
            if (!response.ok) {
                console.warn('[TrueVision3D] Drawing planes config fetch failed (' + response.status + ') - using built-in defaults.');
                return true;                                                     // <-- The defaults ARE the shipped config: still usable
            }
            Na__PlaneCfg__Config = await response.json();
            return Na__PlaneCfg__IsEnabled();
        } catch (error) {
            console.warn('[TrueVision3D] Drawing planes config unreadable - using built-in defaults.', error);
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
    function Na__PlaneCfg__Load() {
        if (!Na__PlaneCfg__LoadPromise) Na__PlaneCfg__LoadPromise = Na__PlaneCfg__Fetch();
        return Na__PlaneCfg__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Drawing Planes System Switched On?
    // ------------------------------------------------------------
    // True until a config that loaded says otherwise, so the controls a panel
    // builds before the fetch settles are not built and then contradicted.
    // ------------------------------------------------------------
    function Na__PlaneCfg__IsEnabled() {
        if (!Na__PlaneCfg__Config) return true;
        return Na__PlaneCfg__Config.DrawingPlanes__Enabled !== false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Snap, Bounds, Appearance, Grip and Labels
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Snap Defaults and the Increment List
    // ------------------------------------------------------------
    // The list comes back sorted and de-duplicated, and always holds the
    // default, so the stepper can never start on a value it cannot step from.
    // ------------------------------------------------------------
    function Na__PlaneCfg__GetSnapSetup() {
        const raw  = Na__PlaneCfg__Val(Na__PlaneCfg__SNAP_BLOCK, 'DrawingPlanes__Snap__IncrementsMm', null);
        let   list = Array.isArray(raw) ? raw.filter((mm) => Number.isFinite(mm) && mm > 0) : [];
        if (list.length === 0) list = Na__PlaneCfg__FALLBACKS.snapIncrementsMm.slice();

        let defaultMm = Na__PlaneCfg__Num(Na__PlaneCfg__SNAP_BLOCK, 'DrawingPlanes__Snap__DefaultIncrementMm', Na__PlaneCfg__FALLBACKS.snapIncrementMm);
        if (!(defaultMm > 0)) defaultMm = Na__PlaneCfg__FALLBACKS.snapIncrementMm;
        if (list.indexOf(defaultMm) === -1) list.push(defaultMm);

        list = Array.from(new Set(list)).sort((a, b) => a - b);

        return {
            enabledByDefault   : Na__PlaneCfg__Val(Na__PlaneCfg__SNAP_BLOCK, 'DrawingPlanes__Snap__EnabledByDefault', Na__PlaneCfg__FALLBACKS.snapEnabled) !== false,
            defaultIncrementMm : defaultMm,
            incrementsMm       : list
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Bounds Setup (scene units where named Units)
    // ------------------------------------------------------------
    function Na__PlaneCfg__GetBoundsSetup() {
        const B = Na__PlaneCfg__BOUNDS_BLOCK;
        const F = Na__PlaneCfg__FALLBACKS;
        return {
            buildingTokens        : Na__PlaneCfg__Strings(B, 'DrawingPlanes__Bounds__BuildingCategoryTokens', F.buildingTokens),
            groundTokens          : Na__PlaneCfg__Strings(B, 'DrawingPlanes__Bounds__GroundCategoryTokens',   F.groundTokens),
            ignoreTokens          : Na__PlaneCfg__Strings(B, 'DrawingPlanes__Bounds__IgnoreNameTokens',       F.ignoreTokens),
            overshootUnits        : Na__Math__ConvertMmToUnits(Na__PlaneCfg__Num(B, 'DrawingPlanes__Bounds__OvershootMm', F.overshootMm)),
            overshootFraction     : Na__PlaneCfg__Num(B, 'DrawingPlanes__Bounds__OvershootFraction', F.overshootFraction),
            groundLiftUnits       : Na__Math__ConvertMmToUnits(Na__PlaneCfg__Num(B, 'DrawingPlanes__Bounds__GroundLiftMm', F.groundLiftMm)),
            groundMinNormalY      : Na__PlaneCfg__Num(B, 'DrawingPlanes__Bounds__GroundFaceMinNormalY', F.groundMinNormalY),
            minPlaneHeightUnits   : Na__Math__ConvertMmToUnits(Na__PlaneCfg__Num(B, 'DrawingPlanes__Bounds__MinPlaneHeightMm', F.minPlaneHeightMm)),
            fallbackHalfSpanUnits : Na__Math__ConvertMmToUnits(Na__PlaneCfg__Num(B, 'DrawingPlanes__Bounds__FallbackHalfSpanMm', F.fallbackHalfSpanMm)),
            fallbackHeightUnits   : Na__Math__ConvertMmToUnits(Na__PlaneCfg__Num(B, 'DrawingPlanes__Bounds__FallbackHeightMm', F.fallbackHeightMm))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Appearance Setup (scene units where named Units)
    // ------------------------------------------------------------
    function Na__PlaneCfg__GetAppearanceSetup() {
        const L = Na__PlaneCfg__LOOK_BLOCK;
        const F = Na__PlaneCfg__FALLBACKS;
        return {
            palette             : Na__PlaneCfg__Strings(L, 'DrawingPlanes__Appearance__Palette', F.palette),
            planPaletteOffset   : Math.max(0, Math.round(Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__PlanPaletteOffset', F.planPaletteOffset))),
            fillOpacity         : Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__FillOpacity',             F.fillOpacity),
            fillOpacitySelected : Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__FillOpacitySelected',     F.fillOpacitySel),
            sectionFillBoost    : Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__SectionFillOpacityBoost', F.sectionFillBoost),
            outlinePx           : Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__OutlineWidthPx',          F.outlinePx),
            outlineSelectedPx   : Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__OutlineWidthSelectedPx',  F.outlineSelPx),
            ghostOpacity        : Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__GhostOpacity',            F.ghostOpacity),
            padColour           : String(Na__PlaneCfg__Val(L, 'DrawingPlanes__Appearance__PadColour', F.padColour)),
            padOpacity          : Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__PadOpacity',              F.padOpacity),
            gripFraction        : Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__GripSizeFraction',        F.gripFraction),
            gripMinUnits        : Na__Math__ConvertMmToUnits(Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__GripSizeMinMm', F.gripMinMm)),
            gripMaxUnits        : Na__Math__ConvertMmToUnits(Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__GripSizeMaxMm', F.gripMaxMm)),
            arrowFraction       : Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__ArrowLengthFraction',     F.arrowFraction),
            arrowMinUnits       : Na__Math__ConvertMmToUnits(Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__ArrowLengthMinMm', F.arrowMinMm)),
            arrowMaxUnits       : Na__Math__ConvertMmToUnits(Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__ArrowLengthMaxMm', F.arrowMaxMm)),
            labelUppercase      : Na__PlaneCfg__Val(L, 'DrawingPlanes__Appearance__LabelUppercase', F.labelUppercase) !== false,
            labelMaxFraction    : Na__PlaneCfg__Num(L, 'DrawingPlanes__Appearance__LabelMaxWidthFraction',   F.labelMaxFraction),
            labelFont           : String(Na__PlaneCfg__Val(L, 'DrawingPlanes__Appearance__LabelFont', F.labelFont))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Grip Setup
    // ------------------------------------------------------------
    function Na__PlaneCfg__GetGripSetup() {
        const G = Na__PlaneCfg__GRIP_BLOCK;
        const F = Na__PlaneCfg__FALLBACKS;
        return {
            dragRecomputeMs  : Na__PlaneCfg__Num(G, 'DrawingPlanes__Grip__DragRecomputeMs',  F.dragRecomputeMs),
            clickThresholdPx : Na__PlaneCfg__Num(G, 'DrawingPlanes__Grip__ClickThresholdPx', F.clickThresholdPx),
            minAxisAngleDeg  : Na__PlaneCfg__Num(G, 'DrawingPlanes__Grip__MinAxisAngleDeg',  F.minAxisAngleDeg),
            hoverCursor      : String(Na__PlaneCfg__Val(G, 'DrawingPlanes__Grip__HoverCursor', F.hoverCursor)),
            dragCursor       : String(Na__PlaneCfg__Val(G, 'DrawingPlanes__Grip__DragCursor',  F.dragCursor)),
            pickCursor       : String(Na__PlaneCfg__Val(G, 'DrawingPlanes__Grip__PickCursor',  F.pickCursor)),
            floorMinNormalY  : Na__PlaneCfg__Num(G, 'DrawingPlanes__Grip__FloorFaceMinNormalY', F.floorMinNormalY)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a User-Facing Label
    // ------------------------------------------------------------
    // shortKey is the key's tail: 'SnapLabel' reads DrawingPlanes__Labels__SnapLabel.
    // ------------------------------------------------------------
    function Na__PlaneCfg__GetLabel(shortKey, fallback) {
        const value = Na__PlaneCfg__Val(Na__PlaneCfg__LABELS_BLOCK, 'DrawingPlanes__Labels__' + shortKey, fallback);
        return (typeof value === 'string' && value.length > 0) ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a Label With {token} Placeholders Filled In
    // ------------------------------------------------------------
    function Na__PlaneCfg__FormatLabel(shortKey, fallback, tokens) {
        let text = Na__PlaneCfg__GetLabel(shortKey, fallback);
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

    // MODULE EXPORTS | Drawing Planes Config API
    // ------------------------------------------------------------
    export {
        Na__PlaneCfg__Load,
        Na__PlaneCfg__IsEnabled,
        Na__PlaneCfg__GetSnapSetup,
        Na__PlaneCfg__GetBoundsSetup,
        Na__PlaneCfg__GetAppearanceSetup,
        Na__PlaneCfg__GetGripSetup,
        Na__PlaneCfg__GetLabel,
        Na__PlaneCfg__FormatLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
