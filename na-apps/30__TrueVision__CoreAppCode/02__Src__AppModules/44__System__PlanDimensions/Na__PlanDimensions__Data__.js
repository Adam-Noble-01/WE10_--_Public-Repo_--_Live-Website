// =============================================================================
// TRUEVISION3D - PLAN DIMENSIONS - DATA MODEL AND CONFIG
// =============================================================================
//
// FILE       : Na__PlanDimensions__Data__.js
// NAMESPACE  : Na__PlanDim
// MODULE     : Plan Dimensions - Data Model and Config
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the dimension record shape, its config, and per-plan storage
// CREATED    : 31-Aug-2026
//
// DESCRIPTION:
// - Dimensions ride INSIDE each floor plan record, as FloorPlan__Dimensions,
//   exactly as that plan's annotations ride in FloorPlan__Annotations. Floor
//   plans themselves are nested inside PresentationMode__SavedCameraScenes,
//   which is already on all three dev-owned key lists, so dimensions inherit
//   the existing R2 overlay / build-preserve / sync-preserve path and need no
//   new top-level key and no lockstep edit of those three lists.
// - A dimension stores only its two snapped endpoints, an axis lock and a
//   perpendicular offset. The LENGTH IS NEVER STORED - it is recomputed from
//   the endpoints on every read. Storing a measured figure alongside the
//   geometry that produces it is how drawings end up lying: the two drift
//   apart the moment anything is edited, and the number is the half everyone
//   trusts. Derived-on-read cannot drift.
// - Endpoints arrive already snapped by Na__PlanDimensions__Grid__, and are
//   re-snapped on normalise so a hand-edited JSON figure is pulled back onto
//   the grid rather than rendering half a step off every other dimension.
//
// INTEGRATION:
// - Na__PlanDimensions__Overlay__ reads through here to draw the SVG layer.
// - Na__PlanDimensions__Editor__ mutates through here.
// - Na__FloorPlan__ModeController__ resolves the per-plan array through
//   GetPlanDimensions and hands it to both of them.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Aug-2026 - Version 1.0.0
// - Initial implementation for the Floor Plan Builder dimensioning system.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Snap Grid
    // ------------------------------------------------------------
    // @delegate: ./Na__PlanDimensions__Grid__.js
    // ------------------------------------------------------------
    import {
        Na__PlanDimGrid__AXIS_X,
        Na__PlanDimGrid__AXIS_Z,
        Na__PlanDimGrid__AXIS_FREE,
        Na__PlanDimGrid__Configure,
        Na__PlanDimGrid__SnapValueMm,
        Na__PlanDimGrid__SnapMeasurementMm
    } from './Na__PlanDimensions__Grid__.js';
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
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Record Field Names
    // ------------------------------------------------------------
    const Na__PlanDim__F_ID       = 'Dimension__Id';
    const Na__PlanDim__F_AXIS     = 'Dimension__Axis';
    const Na__PlanDim__F_START_X  = 'Dimension__StartXMm';
    const Na__PlanDim__F_START_Z  = 'Dimension__StartZMm';
    const Na__PlanDim__F_END_X    = 'Dimension__EndXMm';
    const Na__PlanDim__F_END_Z    = 'Dimension__EndZMm';
    const Na__PlanDim__F_OFFSET   = 'Dimension__OffsetMm';
    const Na__PlanDim__F_SIZE     = 'Dimension__TextSizeMm';
    const Na__PlanDim__F_WEIGHT   = 'Dimension__FontWeight';
    const Na__PlanDim__F_COLOR    = 'Dimension__Color';
    const Na__PlanDim__F_TERM     = 'Dimension__Terminator';
    const Na__PlanDim__F_OVERRIDE = 'Dimension__OverrideText';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Plan Record Storage Field
    // ------------------------------------------------------------
    // Deliberately mirrors FloorPlan__Annotations. Accessed here rather than
    // through Na__FloorPlan__ProjectJson__Data__ so the dimensioning system
    // adds nothing to that module's surface.
    // ------------------------------------------------------------
    const Na__PlanDim__PLAN_FIELD = 'FloorPlan__Dimensions';
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
    let Na__PlanDim__NewDefaults = null; // <-- Live defaults for the NEXT dimension (seeded from config)
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
// REGION | Per-Plan Storage
// -----------------------------------------------------------------------------

    // FUNCTION | Get a Plan's Dimension Array, Creating It On First Use
    // ------------------------------------------------------------
    // Returns the LIVE array off the plan record, never a copy: the overlay,
    // the editor and the record that gets saved to R2 must all be bound to one
    // reference or an edit will be drawn but never persisted.
    // ------------------------------------------------------------
    function Na__PlanDim__GetPlanDimensions(plan) {
        if (!plan || typeof plan !== 'object') return [];
        if (!Array.isArray(plan[Na__PlanDim__PLAN_FIELD])) {
            plan[Na__PlanDim__PLAN_FIELD] = [];                              // <-- Seed on first use
        }
        return plan[Na__PlanDim__PLAN_FIELD];
    }
    // ------------------------------------------------------------


    // FUNCTION | Replace a Plan's Dimension Array Wholesale
    // ------------------------------------------------------------
    function Na__PlanDim__SetPlanDimensions(plan, dimensions) {
        if (!plan || typeof plan !== 'object') return false;
        plan[Na__PlanDim__PLAN_FIELD] = Array.isArray(dimensions) ? dimensions : [];
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Record Validation and Normalisation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Coerce a Font Weight onto an Allowed Face
    // ------------------------------------------------------------
    // Only the three Open Sans faces the app loads will actually render, so a
    // value outside that set is pulled back to the default rather than being
    // handed to the browser to approximate.
    // ------------------------------------------------------------
    function Na__PlanDim__CoerceWeight(weight) {
        const setup   = Na__PlanDim__GetTextSetup();
        const allowed = Array.isArray(setup.allowedWeights) ? setup.allowedWeights : [400];
        const numeric = Number(weight);
        return allowed.includes(numeric) ? numeric : setup.defaultWeight;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Coerce an Axis Value
    // ------------------------------------------------------------
    function Na__PlanDim__CoerceAxis(axis) {
        if (axis === Na__PlanDimGrid__AXIS_X) return Na__PlanDimGrid__AXIS_X;
        if (axis === Na__PlanDimGrid__AXIS_Z) return Na__PlanDimGrid__AXIS_Z;
        return Na__PlanDimGrid__AXIS_FREE;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Stored Record Usable?
    // ------------------------------------------------------------
    function Na__PlanDim__IsValid(record) {
        if (!record || typeof record !== 'object') return false;
        if (!record[Na__PlanDim__F_ID]) return false;
        return Number.isFinite(record[Na__PlanDim__F_START_X])
            && Number.isFinite(record[Na__PlanDim__F_START_Z])
            && Number.isFinite(record[Na__PlanDim__F_END_X])
            && Number.isFinite(record[Na__PlanDim__F_END_Z]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fill Gaps and Pull Endpoints Back onto the Grid
    // ------------------------------------------------------------
    // Mutates in place so the normalised values are what subsequently save.
    // Re-snapping matters: a hand-edited or older-tolerance figure is dragged
    // onto the current grid rather than rendering out of step with its
    // neighbours on the same drawing.
    // ------------------------------------------------------------
    function Na__PlanDim__Normalise(record) {
        const lineSetup = Na__PlanDim__GetLineSetup();
        const textSetup = Na__PlanDim__GetTextSetup();

        record[Na__PlanDim__F_START_X] = Na__PlanDimGrid__SnapValueMm(record[Na__PlanDim__F_START_X]);
        record[Na__PlanDim__F_START_Z] = Na__PlanDimGrid__SnapValueMm(record[Na__PlanDim__F_START_Z]);
        record[Na__PlanDim__F_END_X]   = Na__PlanDimGrid__SnapValueMm(record[Na__PlanDim__F_END_X]);
        record[Na__PlanDim__F_END_Z]   = Na__PlanDimGrid__SnapValueMm(record[Na__PlanDim__F_END_Z]);

        record[Na__PlanDim__F_AXIS] = Na__PlanDim__CoerceAxis(record[Na__PlanDim__F_AXIS]);

        if (!Number.isFinite(record[Na__PlanDim__F_OFFSET])) {
            record[Na__PlanDim__F_OFFSET] = lineSetup.defaultOffsetMm;
        }
        if (!Number.isFinite(record[Na__PlanDim__F_SIZE])) {
            record[Na__PlanDim__F_SIZE] = textSetup.defaultSizeMm;
        }
        record[Na__PlanDim__F_WEIGHT] = Na__PlanDim__CoerceWeight(record[Na__PlanDim__F_WEIGHT]);

        if (typeof record[Na__PlanDim__F_COLOR] !== 'string') {
            record[Na__PlanDim__F_COLOR] = lineSetup.defaultColor;
        }
        if (typeof record[Na__PlanDim__F_TERM] !== 'string') {
            record[Na__PlanDim__F_TERM] = lineSetup.terminator;
        }

        return record;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read and Normalise Every Usable Record in an Array
    // ------------------------------------------------------------
    function Na__PlanDim__ReadAll(dimensionArray) {
        if (!Array.isArray(dimensionArray)) return [];
        return dimensionArray
            .filter(Na__PlanDim__IsValid)
            .map(Na__PlanDim__Normalise);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Measurement and Formatting
// -----------------------------------------------------------------------------

    // FUNCTION | Recompute a Record's Length From Its Stored Endpoints
    // ------------------------------------------------------------
    // The single source of truth for what a dimension reads. Nothing caches
    // this, so a moved endpoint cannot leave a stale figure on the drawing.
    // ------------------------------------------------------------
    function Na__PlanDim__MeasureLengthMm(record) {
        if (!Na__PlanDim__IsValid(record)) return 0;

        const deltaX = record[Na__PlanDim__F_END_X] - record[Na__PlanDim__F_START_X];
        const deltaZ = record[Na__PlanDim__F_END_Z] - record[Na__PlanDim__F_START_Z];

        return Na__PlanDimGrid__SnapMeasurementMm(
            Math.sqrt((deltaX * deltaX) + (deltaZ * deltaZ))
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Format a Length for the Drawing
    // ------------------------------------------------------------
    // An explicit override string wins over the measured figure, for the
    // occasional "VARIES" or a dimension deliberately shown to a stated size.
    // ------------------------------------------------------------
    function Na__PlanDim__FormatLength(lengthMm, record) {
        if (record && typeof record[Na__PlanDim__F_OVERRIDE] === 'string'
            && record[Na__PlanDim__F_OVERRIDE].trim().length > 0) {
            return record[Na__PlanDim__F_OVERRIDE].trim();
        }

        const setup   = Na__PlanDim__GetTextSetup();
        const rounded = Math.round(lengthMm);
        const body    = setup.thousandsSep ? rounded.toLocaleString() : String(rounded);

        return setup.unitsSuffix ? `${body}${setup.unitsSuffix}` : body;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Record CRUD
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Allocate the Next Free Id Within One Plan
    // ------------------------------------------------------------
    // Ids are unique per plan, not globally: two plans each holding a
    // dimension 1 is correct, because a plan's markup is independent.
    // ------------------------------------------------------------
    function Na__PlanDim__NextId(dimensionArray) {
        let highest = 0;
        if (Array.isArray(dimensionArray)) {
            for (let i = 0; i < dimensionArray.length; i++) {
                const id = dimensionArray[i] && dimensionArray[i][Na__PlanDim__F_ID];
                if (Number.isFinite(id) && id > highest) highest = id;
            }
        }
        return highest + 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Create a Dimension From a Resolved Span
    // ------------------------------------------------------------
    // Takes the span object produced by Na__PlanDimGrid__ResolveSpan, which
    // has already snapped both ends, applied the axis lock and rejected
    // degenerate picks - so anything arriving here is known good.
    // ------------------------------------------------------------
    function Na__PlanDim__Create(dimensionArray, span, options) {
        if (!Array.isArray(dimensionArray) || !span || !span.start || !span.end) return null;

        const defaults = Na__PlanDim__GetNewDefaults();                      // <-- What the preview just showed
        const opts     = options || {};

        const record = {};
        record[Na__PlanDim__F_ID]      = Na__PlanDim__NextId(dimensionArray);
        record[Na__PlanDim__F_AXIS]    = Na__PlanDim__CoerceAxis(span.axis);
        record[Na__PlanDim__F_START_X] = Math.round(span.start.posXMm);
        record[Na__PlanDim__F_START_Z] = Math.round(span.start.posZMm);
        record[Na__PlanDim__F_END_X]   = Math.round(span.end.posXMm);
        record[Na__PlanDim__F_END_Z]   = Math.round(span.end.posZMm);
        record[Na__PlanDim__F_OFFSET]  = Number.isFinite(opts.offsetMm) ? opts.offsetMm : defaults.offsetMm;
        record[Na__PlanDim__F_SIZE]    = Number.isFinite(opts.sizeMm)   ? opts.sizeMm   : defaults.sizeMm;
        record[Na__PlanDim__F_WEIGHT]  = Na__PlanDim__CoerceWeight(
            opts.fontWeight !== undefined ? opts.fontWeight : defaults.fontWeight);
        record[Na__PlanDim__F_COLOR]   = (typeof opts.color === 'string') ? opts.color : defaults.color;
        record[Na__PlanDim__F_TERM]    = (typeof opts.terminator === 'string') ? opts.terminator : defaults.terminator;

        dimensionArray.push(record);
        return record;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Live Defaults Applied to the NEXT Dimension
    // ------------------------------------------------------------
    // Seeded from AppConfig on first read, then editable from the toolbar so
    // the author can set text size and colour BEFORE drawing rather than
    // placing a dimension and correcting it afterwards. The placement preview
    // renders from these same values, so what is previewed is what is created.
    // ------------------------------------------------------------
    function Na__PlanDim__GetNewDefaults() {
        if (!Na__PlanDim__NewDefaults) {
            const lineSetup = Na__PlanDim__GetLineSetup();
            const textSetup = Na__PlanDim__GetTextSetup();
            Na__PlanDim__NewDefaults = {
                sizeMm     : textSetup.defaultSizeMm,
                fontWeight : textSetup.defaultWeight,
                color      : lineSetup.defaultColor,
                terminator : lineSetup.terminator,
                offsetMm   : lineSetup.defaultOffsetMm
            };
        }
        return Na__PlanDim__NewDefaults;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change the Defaults Applied to the NEXT Dimension
    // ------------------------------------------------------------
    // Returns true when something actually changed, so a caller only pays for
    // a redraw when there is one to do.
    // ------------------------------------------------------------
    function Na__PlanDim__SetNewDefaults(patch) {
        if (!patch || typeof patch !== 'object') return false;

        const current = Na__PlanDim__GetNewDefaults();
        const text    = Na__PlanDim__GetTextSetup();
        let   changed = false;

        if (Number.isFinite(patch.sizeMm)) {
            const clamped = Math.min(text.maxSizeMm, Math.max(text.minSizeMm, patch.sizeMm));
            if (clamped !== current.sizeMm) { current.sizeMm = clamped; changed = true; }
        }
        if (patch.fontWeight !== undefined) {
            const weight = Na__PlanDim__CoerceWeight(patch.fontWeight);
            if (weight !== current.fontWeight) { current.fontWeight = weight; changed = true; }
        }
        if (typeof patch.color === 'string' && patch.color !== current.color) {
            current.color = patch.color;
            changed = true;
        }
        if (typeof patch.terminator === 'string' && patch.terminator !== current.terminator) {
            current.terminator = patch.terminator;
            changed = true;
        }
        return changed;
    }
    // ------------------------------------------------------------


    // FUNCTION | Find One Record by Id
    // ------------------------------------------------------------
    function Na__PlanDim__FindById(dimensionArray, dimensionId) {
        if (!Array.isArray(dimensionArray)) return null;
        for (let i = 0; i < dimensionArray.length; i++) {
            if (dimensionArray[i] && dimensionArray[i][Na__PlanDim__F_ID] === dimensionId) {
                return dimensionArray[i];
            }
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove One Record by Id
    // ------------------------------------------------------------
    function Na__PlanDim__Delete(dimensionArray, dimensionId) {
        if (!Array.isArray(dimensionArray)) return false;
        for (let i = 0; i < dimensionArray.length; i++) {
            if (dimensionArray[i] && dimensionArray[i][Na__PlanDim__F_ID] === dimensionId) {
                dimensionArray.splice(i, 1);
                return true;
            }
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set a Record's Perpendicular Offset (Clamped)
    // ------------------------------------------------------------
    function Na__PlanDim__SetOffsetMm(record, offsetMm) {
        if (!record || !Number.isFinite(offsetMm)) return false;
        const setup = Na__PlanDim__GetLineSetup();
        record[Na__PlanDim__F_OFFSET] = Math.min(Math.max(offsetMm, setup.minOffsetMm), setup.maxOffsetMm);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move One Endpoint, Re-Snapping It onto the Grid
    // ------------------------------------------------------------
    function Na__PlanDim__SetEndpoint(record, which, point) {
        if (!record || !point) return false;

        const snappedX = Na__PlanDimGrid__SnapValueMm(point.posXMm);
        const snappedZ = Na__PlanDimGrid__SnapValueMm(point.posZMm);

        if (which === 'start') {
            record[Na__PlanDim__F_START_X] = snappedX;
            record[Na__PlanDim__F_START_Z] = snappedZ;
        } else {
            record[Na__PlanDim__F_END_X] = snappedX;
            record[Na__PlanDim__F_END_Z] = snappedZ;
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply a Partial Update to a Record
    // ------------------------------------------------------------
    function Na__PlanDim__Update(record, patch) {
        if (!record || !patch) return false;

        if (Number.isFinite(patch.sizeMm))    record[Na__PlanDim__F_SIZE]   = patch.sizeMm;
        if (patch.fontWeight !== undefined)   record[Na__PlanDim__F_WEIGHT] = Na__PlanDim__CoerceWeight(patch.fontWeight);
        if (typeof patch.color === 'string')  record[Na__PlanDim__F_COLOR]  = patch.color;
        if (typeof patch.terminator === 'string') record[Na__PlanDim__F_TERM] = patch.terminator;
        if (typeof patch.overrideText === 'string') record[Na__PlanDim__F_OVERRIDE] = patch.overrideText;
        if (Number.isFinite(patch.offsetMm))  Na__PlanDim__SetOffsetMm(record, patch.offsetMm);

        return true;
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

    // MODULE EXPORTS | Plan Dimensions Data API
    // ------------------------------------------------------------
    export {
        Na__PlanDim__F_ID,
        Na__PlanDim__F_AXIS,
        Na__PlanDim__F_START_X,
        Na__PlanDim__F_START_Z,
        Na__PlanDim__F_END_X,
        Na__PlanDim__F_END_Z,
        Na__PlanDim__F_OFFSET,
        Na__PlanDim__F_SIZE,
        Na__PlanDim__F_WEIGHT,
        Na__PlanDim__F_COLOR,
        Na__PlanDim__F_TERM,
        Na__PlanDim__PLAN_FIELD,
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
        Na__PlanDim__GetNewDefaults,
        Na__PlanDim__SetNewDefaults,
        Na__PlanDim__GetPlanDimensions,
        Na__PlanDim__SetPlanDimensions,
        Na__PlanDim__ReadAll,
        Na__PlanDim__MeasureLengthMm,
        Na__PlanDim__FormatLength,
        Na__PlanDim__Create,
        Na__PlanDim__FindById,
        Na__PlanDim__Delete,
        Na__PlanDim__SetOffsetMm,
        Na__PlanDim__SetEndpoint,
        Na__PlanDim__Update,
        Na__PlanDim__CoerceWeight
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
