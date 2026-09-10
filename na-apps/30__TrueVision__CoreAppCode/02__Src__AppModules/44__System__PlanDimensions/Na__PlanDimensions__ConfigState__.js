// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - CONFIG STATE
// =============================================================================
//
// FILE       : Na__PlanDimensions__ConfigState__.js
// NAMESPACE  : Na__PlanDim
// MODULE     : Plan Dimensions - Config State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the dimension AppConfig fetch and expose every tuned value
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Fetches Na__PlanDimensions__AppConfig__.json once, configures the snap
//   grid from the same document, and exposes the grid, line, text, layer,
//   interaction, axis lock, editing, crosshair, client mode, disclaimer and
//   label blocks through getters with built-in fallbacks.
// - Every value has a fallback matching the shipped JSON, so a failed fetch
//   degrades to a working 5 mm grid rather than taking dimensioning down.
// - Pure config. No DOM, no Three.js objects, no records.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ awaits Na__PlanDim__Load() during init;
//   every other dimension module reads through these getters.
// - Na__PlanDimensions__Data__ imports the three blocks it normalises against.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 45__System__PlanDimensions/Na__PlanDimensions__ConfigState__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.0.0
// - Initial split from Na__PlanDimensions__Data__.js during port Phase 2.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Snap Grid (configured from this document)
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Grid__.js
    // ------------------------------------------------------------
    import { Na__PlanDimGrid__Configure } from './Na__PlanDimensions__Grid__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Block Names
    // ------------------------------------------------------------
    const Na__PlanDim__ConfigUrl    = new URL('./Na__PlanDimensions__AppConfig__.json', import.meta.url);
    const Na__PlanDim__GRID_BLOCK   = 'PlanDimensions__Grid__Config';
    const Na__PlanDim__LINE_BLOCK   = 'PlanDimensions__Line__Config';
    const Na__PlanDim__TEXT_BLOCK   = 'PlanDimensions__Text__Config';
    const Na__PlanDim__LAYER_BLOCK  = 'PlanDimensions__Layer__Config';
    const Na__PlanDim__INTER_BLOCK  = 'PlanDimensions__Interaction__Config';
    const Na__PlanDim__AXIS_BLOCK   = 'PlanDimensions__AxisLock__Config';
    const Na__PlanDim__EDIT_BLOCK   = 'PlanDimensions__Editing__Config';
    const Na__PlanDim__LABELS_BLOCK = 'PlanDimensions__Labels__Config';
    const Na__PlanDim__CROSS_BLOCK  = 'PlanDimensions__Crosshair__Config';
    const Na__PlanDim__CLIENT_BLOCK = 'PlanDimensions__ClientMode__Config';
    const Na__PlanDim__DISC_BLOCK   = 'PlanDimensions__Disclaimer__Config';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallbacks (used when the config file cannot be read)
    // ------------------------------------------------------------
    const Na__PlanDim__FALLBACKS = {
        orthoDefault    : false,
        shiftConstrains : true,
        arrowLock       : true,
        guideEnabled    : true,
        guideColorX     : '#d2333c',
        guideColorZ     : '#2f9e44',
        guideOpacity    : 0.55,
        guideStrokePx   : 1.25,
        guideDash       : '6 5',
        crossEnabled    : true,
        crossColor      : '#323232',
        crossOpacity    : 0.5,
        crossStrokePx   : 0.75,
        crossDash       : '3 4',
        crossBeforeClick: true,
        undoDepth       : 50,
        dblClickVerts   : true,
        vertexSizePx    : 9,
        vertexStrokePx  : 1.8,
        vertexColor     : '#2e7d4f',
        vertexActive    : '#d2333c',
        vertexHitPx     : 14,
        deleteKeys      : ['Delete', 'Backspace'],
        undoKey         : 'z',
        redoKey         : 'y',
        orthoKey        : 'o',
        placeKey        : 'd',
        defaultOffsetMm : 750,
        offsetStepMm    : 50,
        minOffsetMm     : -20000,
        maxOffsetMm     : 20000,
        overshootMm     : 150,
        extGapMm        : 100,
        tickLengthMm    : 200,
        strokeWidthMm   : 15,
        defaultColor    : '#323232',
        terminator      : 'tick',
        terminators     : ['tick', 'arrow', 'dot'],
        defaultSizeMm   : 220,
        minSizeMm       : 50,
        maxSizeMm       : 2000,
        sizeStepMm      : 25,
        defaultWeight   : 400,
        allowedWeights  : [300, 400, 600],
        fontFamily      : "'Open Sans', sans-serif",
        unitsSuffix     : '',
        thousandsSep    : true,
        textGapMm       : 120,
        planeOffsetMm   : 60,
        minRenderedPx   : 6,
        maxRenderedPx   : 400,
        zIndex          : 39,
        dragThresholdPx : 3,
        axisLockEnabled : true,
        axisLockTolPx   : 12,
        axisOverrideKey : 'Shift',
        showSnapPreview : true
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Loaded Configuration
    // ------------------------------------------------------------
    let Na__PlanDim__Config = null;      // <-- Parsed AppConfig document (or null before Load)
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config Access Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read Any Value From a Config Block
    // ------------------------------------------------------------
    function Na__PlanDim__Val(blockName, keyName, fallback) {
        if (!Na__PlanDim__Config) return fallback;
        const block = Na__PlanDim__Config[blockName];
        if (!block) return fallback;
        const value = block[keyName];
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Finite Number From a Config Block
    // ------------------------------------------------------------
    function Na__PlanDim__Num(blockName, keyName, fallback) {
        const value = Na__PlanDim__Val(blockName, keyName, fallback);
        return Number.isFinite(value) ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the Dimension AppConfig and Configure the Snap Grid
    // ------------------------------------------------------------
    // Always resolves. A missing or malformed config leaves every fallback in
    // place, which keeps the 5 mm grid working rather than taking the whole
    // dimensioning system down with it.
    // ------------------------------------------------------------
    async function Na__PlanDim__Load() {
        try {
            const response = await fetch(Na__PlanDim__ConfigUrl, { cache: 'no-cache' });
            if (response.ok) {
                Na__PlanDim__Config = await response.json();
            } else {
                console.warn(`[TrueVision3D] Plan dimensions config HTTP ${response.status}; using fallbacks.`);
            }
        } catch (error) {
            console.warn('[TrueVision3D] Plan dimensions config load failed; using fallbacks.', error);
        }

        Na__PlanDimGrid__Configure(Na__PlanDim__GetGridSetup());             // <-- Grid is configured from the same document
        return Na__PlanDim__Config;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Dimensioning System Switched On?
    // ------------------------------------------------------------
    function Na__PlanDim__IsEnabled() {
        if (!Na__PlanDim__Config) return true;                               // <-- Fallback config is a working config
        return Na__PlanDim__Config.PlanDimensions__Enabled !== false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Grid Setup Block
    // ------------------------------------------------------------
    function Na__PlanDim__GetGridSetup() {
        return {
            snapStepMm        : Na__PlanDim__Num(Na__PlanDim__GRID_BLOCK, 'PlanDimensions__Grid__SnapStepMm',        5),
            measurementSnapMm : Na__PlanDim__Num(Na__PlanDim__GRID_BLOCK, 'PlanDimensions__Grid__MeasurementSnapMm', 5),
            originXMm         : Na__PlanDim__Num(Na__PlanDim__GRID_BLOCK, 'PlanDimensions__Grid__OriginXMm',         0),
            originZMm         : Na__PlanDim__Num(Na__PlanDim__GRID_BLOCK, 'PlanDimensions__Grid__OriginZMm',         0),
            planeMarginMm     : Na__PlanDim__Num(Na__PlanDim__GRID_BLOCK, 'PlanDimensions__Grid__PlaneMarginMm',     5000),
            maxSpanMm         : Na__PlanDim__Num(Na__PlanDim__GRID_BLOCK, 'PlanDimensions__Grid__MaxSpanMm',         500000),
            minSpanMm         : Na__PlanDim__Num(Na__PlanDim__GRID_BLOCK, 'PlanDimensions__Grid__MinSpanMm',         5)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Line Setup Block
    // ------------------------------------------------------------
    function Na__PlanDim__GetLineSetup() {
        const F = Na__PlanDim__FALLBACKS;
        return {
            defaultOffsetMm : Na__PlanDim__Num(Na__PlanDim__LINE_BLOCK, 'PlanDimensions__Line__DefaultOffsetMm',      F.defaultOffsetMm),
            offsetStepMm    : Na__PlanDim__Num(Na__PlanDim__LINE_BLOCK, 'PlanDimensions__Line__OffsetStepMm',         F.offsetStepMm),
            minOffsetMm     : Na__PlanDim__Num(Na__PlanDim__LINE_BLOCK, 'PlanDimensions__Line__MinOffsetMm',          F.minOffsetMm),
            maxOffsetMm     : Na__PlanDim__Num(Na__PlanDim__LINE_BLOCK, 'PlanDimensions__Line__MaxOffsetMm',          F.maxOffsetMm),
            overshootMm     : Na__PlanDim__Num(Na__PlanDim__LINE_BLOCK, 'PlanDimensions__Line__ExtensionOvershootMm', F.overshootMm),
            extGapMm        : Na__PlanDim__Num(Na__PlanDim__LINE_BLOCK, 'PlanDimensions__Line__ExtensionGapMm',       F.extGapMm),
            tickLengthMm    : Na__PlanDim__Num(Na__PlanDim__LINE_BLOCK, 'PlanDimensions__Line__TickLengthMm',         F.tickLengthMm),
            strokeWidthMm   : Na__PlanDim__Num(Na__PlanDim__LINE_BLOCK, 'PlanDimensions__Line__StrokeWidthMm',        F.strokeWidthMm),
            defaultColor    : Na__PlanDim__Val(Na__PlanDim__LINE_BLOCK, 'PlanDimensions__Line__DefaultColor',         F.defaultColor),
            terminator      : Na__PlanDim__Val(Na__PlanDim__LINE_BLOCK, 'PlanDimensions__Line__TerminatorStyle',      F.terminator),
            terminators     : Na__PlanDim__Val(Na__PlanDim__LINE_BLOCK, 'PlanDimensions__Line__AllowedTerminatorStyles', F.terminators)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Text Setup Block
    // ------------------------------------------------------------
    function Na__PlanDim__GetTextSetup() {
        const F = Na__PlanDim__FALLBACKS;
        return {
            defaultSizeMm  : Na__PlanDim__Num(Na__PlanDim__TEXT_BLOCK, 'PlanDimensions__Text__DefaultSizeMm',      F.defaultSizeMm),
            minSizeMm      : Na__PlanDim__Num(Na__PlanDim__TEXT_BLOCK, 'PlanDimensions__Text__MinSizeMm',          F.minSizeMm),
            maxSizeMm      : Na__PlanDim__Num(Na__PlanDim__TEXT_BLOCK, 'PlanDimensions__Text__MaxSizeMm',          F.maxSizeMm),
            sizeStepMm     : Na__PlanDim__Num(Na__PlanDim__TEXT_BLOCK, 'PlanDimensions__Text__SizeStepMm',         F.sizeStepMm),
            defaultWeight  : Na__PlanDim__Num(Na__PlanDim__TEXT_BLOCK, 'PlanDimensions__Text__DefaultFontWeight',  F.defaultWeight),
            allowedWeights : Na__PlanDim__Val(Na__PlanDim__TEXT_BLOCK, 'PlanDimensions__Text__AllowedFontWeights', F.allowedWeights),
            fontFamily     : Na__PlanDim__Val(Na__PlanDim__TEXT_BLOCK, 'PlanDimensions__Text__FontFamily',         F.fontFamily),
            unitsSuffix    : Na__PlanDim__Val(Na__PlanDim__TEXT_BLOCK, 'PlanDimensions__Text__UnitsSuffix',        F.unitsSuffix),
            thousandsSep   : Na__PlanDim__Val(Na__PlanDim__TEXT_BLOCK, 'PlanDimensions__Text__ThousandsSeparator', F.thousandsSep),
            textGapMm      : Na__PlanDim__Num(Na__PlanDim__TEXT_BLOCK, 'PlanDimensions__Text__GapAroundTextMm',    F.textGapMm)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Layer Setup Block
    // ------------------------------------------------------------
    function Na__PlanDim__GetLayerSetup() {
        const F = Na__PlanDim__FALLBACKS;
        return {
            planeOffsetMm : Na__PlanDim__Num(Na__PlanDim__LAYER_BLOCK, 'PlanDimensions__Layer__PlaneOffsetBelowCameraMm', F.planeOffsetMm),
            minRenderedPx : Na__PlanDim__Num(Na__PlanDim__LAYER_BLOCK, 'PlanDimensions__Layer__MinRenderedPx',            F.minRenderedPx),
            maxRenderedPx : Na__PlanDim__Num(Na__PlanDim__LAYER_BLOCK, 'PlanDimensions__Layer__MaxRenderedPx',            F.maxRenderedPx),
            zIndex        : Na__PlanDim__Num(Na__PlanDim__LAYER_BLOCK, 'PlanDimensions__Layer__ZIndex',                   F.zIndex)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Interaction Setup Block
    // ------------------------------------------------------------
    function Na__PlanDim__GetInteractionSetup() {
        const F = Na__PlanDim__FALLBACKS;
        return {
            dragThresholdPx : Na__PlanDim__Num(Na__PlanDim__INTER_BLOCK, 'PlanDimensions__Interaction__DragThresholdPx',    F.dragThresholdPx),
            axisLockEnabled : Na__PlanDim__Val(Na__PlanDim__INTER_BLOCK, 'PlanDimensions__Interaction__AxisLockEnabled',    F.axisLockEnabled) !== false,
            axisLockTolPx   : Na__PlanDim__Num(Na__PlanDim__INTER_BLOCK, 'PlanDimensions__Interaction__AxisLockTolerancePx', F.axisLockTolPx),
            axisOverrideKey : Na__PlanDim__Val(Na__PlanDim__INTER_BLOCK, 'PlanDimensions__Interaction__AxisLockOverrideKey', F.axisOverrideKey),
            showSnapPreview : Na__PlanDim__Val(Na__PlanDim__INTER_BLOCK, 'PlanDimensions__Interaction__ShowSnapPreview',    F.showSnapPreview) !== false
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Axis Lock, Editing and Label Config
// -----------------------------------------------------------------------------

    // FUNCTION | Read the Axis Lock Block
    // ------------------------------------------------------------
    // Drives the SketchUp Layout style constraint system: the persistent ortho
    // toggle, the Shift-to-constrain behaviour, the arrow key locks, and the
    // dotted guide drawn along whichever axis is active.
    // ------------------------------------------------------------
    function Na__PlanDim__GetAxisLockSetup() {
        const F = Na__PlanDim__FALLBACKS;
        return {
            orthoDefault    : Na__PlanDim__Val(Na__PlanDim__AXIS_BLOCK, 'PlanDimensions__AxisLock__OrthoModeDefault',      F.orthoDefault) === true,
            shiftConstrains : Na__PlanDim__Val(Na__PlanDim__AXIS_BLOCK, 'PlanDimensions__AxisLock__ShiftConstrainsToDrag', F.shiftConstrains) !== false,
            arrowLock       : Na__PlanDim__Val(Na__PlanDim__AXIS_BLOCK, 'PlanDimensions__AxisLock__ArrowKeyLockEnabled',   F.arrowLock) !== false,
            guideEnabled    : Na__PlanDim__Val(Na__PlanDim__AXIS_BLOCK, 'PlanDimensions__AxisLock__GuideEnabled',          F.guideEnabled) !== false,
            guideColorX     : Na__PlanDim__Val(Na__PlanDim__AXIS_BLOCK, 'PlanDimensions__AxisLock__GuideColorX',           F.guideColorX),
            guideColorZ     : Na__PlanDim__Val(Na__PlanDim__AXIS_BLOCK, 'PlanDimensions__AxisLock__GuideColorZ',           F.guideColorZ),
            guideOpacity    : Na__PlanDim__Num(Na__PlanDim__AXIS_BLOCK, 'PlanDimensions__AxisLock__GuideOpacity',          F.guideOpacity),
            guideStrokePx   : Na__PlanDim__Num(Na__PlanDim__AXIS_BLOCK, 'PlanDimensions__AxisLock__GuideStrokePx',         F.guideStrokePx),
            guideDash       : Na__PlanDim__Val(Na__PlanDim__AXIS_BLOCK, 'PlanDimensions__AxisLock__GuideDashPattern',      F.guideDash)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Editing Block
    // ------------------------------------------------------------
    // Selection, undo depth, the vertex handles revealed by a double click,
    // and the keys that drive all of it.
    // ------------------------------------------------------------
    function Na__PlanDim__GetEditingSetup() {
        const F    = Na__PlanDim__FALLBACKS;
        const keys = Na__PlanDim__Val(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__DeleteKeys', F.deleteKeys);
        return {
            undoDepth      : Math.max(1, Na__PlanDim__Num(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__UndoDepth', F.undoDepth)),
            dblClickVerts  : Na__PlanDim__Val(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__DoubleClickToEditVertices', F.dblClickVerts) !== false,
            vertexSizePx   : Na__PlanDim__Num(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__VertexHandleSizePx',        F.vertexSizePx),
            vertexStrokePx : Na__PlanDim__Num(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__VertexHandleStrokePx',      F.vertexStrokePx),
            vertexColor    : Na__PlanDim__Val(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__VertexHandleColor',         F.vertexColor),
            vertexActive   : Na__PlanDim__Val(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__VertexHandleActiveColor',   F.vertexActive),
            vertexHitPx    : Na__PlanDim__Num(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__VertexHitRadiusPx',         F.vertexHitPx),
            deleteKeys     : (Array.isArray(keys) ? keys : F.deleteKeys).map((k) => String(k).toLowerCase()),
            undoKey        : String(Na__PlanDim__Val(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__UndoKey',        F.undoKey)).toLowerCase(),
            redoKey        : String(Na__PlanDim__Val(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__RedoKey',        F.redoKey)).toLowerCase(),
            orthoKey       : String(Na__PlanDim__Val(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__OrthoToggleKey', F.orthoKey)).toLowerCase(),
            placeKey       : String(Na__PlanDim__Val(Na__PlanDim__EDIT_BLOCK, 'PlanDimensions__Editing__PlaceKey',       F.placeKey)).toLowerCase()
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Placement Crosshair Setup
    // ------------------------------------------------------------
    function Na__PlanDim__GetCrosshairSetup() {
        const F = Na__PlanDim__FALLBACKS;
        return {
            enabled              : Na__PlanDim__Val(Na__PlanDim__CROSS_BLOCK, 'PlanDimensions__Crosshair__Enabled',    F.crossEnabled) !== false,
            color                : Na__PlanDim__Val(Na__PlanDim__CROSS_BLOCK, 'PlanDimensions__Crosshair__Color',      F.crossColor),
            opacity              : Na__PlanDim__Num(Na__PlanDim__CROSS_BLOCK, 'PlanDimensions__Crosshair__Opacity',    F.crossOpacity),
            strokePx             : Na__PlanDim__Num(Na__PlanDim__CROSS_BLOCK, 'PlanDimensions__Crosshair__StrokePx',   F.crossStrokePx),
            dash                 : Na__PlanDim__Val(Na__PlanDim__CROSS_BLOCK, 'PlanDimensions__Crosshair__DashPattern', F.crossDash),
            showBeforeFirstClick : Na__PlanDim__Val(Na__PlanDim__CROSS_BLOCK, 'PlanDimensions__Crosshair__ShowBeforeFirstClick', F.crossBeforeClick) !== false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Client Mode Setup
    // ------------------------------------------------------------
    function Na__PlanDim__GetClientModeSetup() {
        return {
            enabledByDefault  : Na__PlanDim__Val(Na__PlanDim__CLIENT_BLOCK, 'PlanDimensions__ClientMode__EnabledByDefault', false) === true,
            color             : Na__PlanDim__Val(Na__PlanDim__CLIENT_BLOCK, 'PlanDimensions__ClientMode__Color', '#d2333c'),
            lockColor         : Na__PlanDim__Val(Na__PlanDim__CLIENT_BLOCK, 'PlanDimensions__ClientMode__LockColor', true) !== false,
            allowDelete       : Na__PlanDim__Val(Na__PlanDim__CLIENT_BLOCK, 'PlanDimensions__ClientMode__AllowDelete', true) !== false,
            allowUndo         : Na__PlanDim__Val(Na__PlanDim__CLIENT_BLOCK, 'PlanDimensions__ClientMode__AllowUndo', true) !== false,
            requireDisclaimer : Na__PlanDim__Val(Na__PlanDim__CLIENT_BLOCK, 'PlanDimensions__ClientMode__RequireDisclaimer', true) !== false,
            disclaimerOnce    : Na__PlanDim__Val(Na__PlanDim__CLIENT_BLOCK, 'PlanDimensions__ClientMode__DisclaimerOncePerSession', true) !== false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Disclaimer Wording
    // ------------------------------------------------------------
    function Na__PlanDim__GetDisclaimerSetup() {
        const body = Na__PlanDim__Val(Na__PlanDim__DISC_BLOCK, 'PlanDimensions__Disclaimer__Body', []);
        return {
            title        : Na__PlanDim__Val(Na__PlanDim__DISC_BLOCK, 'PlanDimensions__Disclaimer__Title', 'Before you measure'),
            body         : Array.isArray(body) ? body : [],
            footerNote   : Na__PlanDim__Val(Na__PlanDim__DISC_BLOCK, 'PlanDimensions__Disclaimer__FooterNote', ''),
            acceptLabel  : Na__PlanDim__Val(Na__PlanDim__DISC_BLOCK, 'PlanDimensions__Disclaimer__AcceptLabel', 'I understand'),
            declineLabel : Na__PlanDim__Val(Na__PlanDim__DISC_BLOCK, 'PlanDimensions__Disclaimer__DeclineLabel', 'Cancel'),
            ariaLabel    : Na__PlanDim__Val(Na__PlanDim__DISC_BLOCK, 'PlanDimensions__Disclaimer__AriaLabel', 'Measuring tool disclaimer')
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read One Toolbar Label by Key Suffix
    // ------------------------------------------------------------
    function Na__PlanDim__GetLabel(keySuffix, fallback) {
        const value = Na__PlanDim__Val(Na__PlanDim__LABELS_BLOCK, 'PlanDimensions__Labels__' + keySuffix, fallback);
        return (typeof value === 'string') ? value : fallback;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Plan Dimensions Config API
    // ------------------------------------------------------------
    export {
        Na__PlanDim__Load,
        Na__PlanDim__IsEnabled,
        Na__PlanDim__GetGridSetup,
        Na__PlanDim__GetLineSetup,
        Na__PlanDim__GetTextSetup,
        Na__PlanDim__GetLayerSetup,
        Na__PlanDim__GetInteractionSetup,
        Na__PlanDim__GetAxisLockSetup,
        Na__PlanDim__GetEditingSetup,
        Na__PlanDim__GetLabel,
        Na__PlanDim__GetCrosshairSetup,
        Na__PlanDim__GetClientModeSetup,
        Na__PlanDim__GetDisclaimerSetup
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
