// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CONFIG STATE - TOOL SETUP
// =============================================================================
//
// FILE       : Na__LayoutEditor__ConfigState__ToolSetup__.js
// NAMESPACE  : Na__LeCfg
// MODULE     : Layout Editor - Config State - Tool Setup
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Answer the setup blocks for the sheet items and the tools that make and edit them
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - The items drawn on a sheet: text, dimensions, vector shapes, and the
//   leaders and specification bubbles.
// - The tools that place and edit them: selection (hit tolerance, grips and
//   the selection box), object snapping, the eyedropper, the clipboard and
//   the Measurements box.
//
// INTEGRATION:
// - Na__LayoutEditor__ConfigState__ re-exports every getter here, so the
//   tools and panels keep importing Na__LayoutEditor__ConfigState__.js.
// - Reads the config through Val, Num, Unit and Choice from
//   Na__LayoutEditor__ConfigState__Readers__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : GetDimensionSetup's defaultExtensionMm and defaultAtScale,
//                   GetShapeSetup's defaultAtScale and GetSnappingSetup's
//                   viewport carry keys.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.1.0
// - GetEditScopeSetup answers autoMoveOnSelect and autoMoveKinds (the kinds a
//   Select press picks the Move tool up for), and GetSelectionSetup answers
//   pickDragPx, doubleClickMs and doubleClickSlopPx (how far a press that
//   picks, or the second press of a double click, travels before it moves).
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__ConfigState__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config Readers
    // ------------------------------------------------------------
    import {
        Na__LeCfg__Val,
        Na__LeCfg__Num,
        Na__LeCfg__Unit,
        Na__LeCfg__Choice
    } from './Na__LayoutEditor__ConfigState__Readers__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Tool Setup Blocks
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Sheet Text Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetTextSetup() {
        const weights = Na__LeCfg__Val('Text', 'AllowedWeights', null);
        return {
            fontFamily         : Na__LeCfg__Val('Text', 'FontFamily', "'Open Sans', Helvetica, Arial, sans-serif"),
            defaultSizeMm      : Na__LeCfg__Num('Text', 'DefaultSizeMm', 3),
            minSizeMm          : Na__LeCfg__Num('Text', 'MinSizeMm', 1.5),
            maxSizeMm          : Na__LeCfg__Num('Text', 'MaxSizeMm', 14),
            sizeStepMm         : Na__LeCfg__Num('Text', 'SizeStepMm', 0.5),
            allowedWeights     : Array.isArray(weights) ? weights : [ 300, 400, 600 ],
            defaultWeight      : Na__LeCfg__Num('Text', 'DefaultWeight', 400),
            defaultColour      : Na__LeCfg__Val('Text', 'DefaultColour', '#172b3a'),
            defaultText        : Na__LeCfg__Val('Text', 'DefaultText', 'Text'),
            lineSpacing        : Math.max(1, Na__LeCfg__Num('Text', 'LineSpacing', 1.2)),
            leaderStrokeMm     : Na__LeCfg__Num('Text', 'LeaderStrokeMm', 0.2),
            rotateStepDeg      : Math.min(90, Math.max(0, Na__LeCfg__Num('Text', 'RotateStepDeg', 15))),   // <-- 0 turns Shift's steps off
            rotateDetentDeg    : Math.min(10, Math.max(0, Na__LeCfg__Num('Text', 'RotateDetentDeg', 2))),  // <-- 0 turns the right-angle detent off
            rotateGripOffsetPx : Math.max(8, Na__LeCfg__Num('Text', 'RotateGripOffsetPx', 22))               // <-- Screen pixels from the outline to the rotate grip
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Sheet Dimension Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetDimensionSetup() {
        const terms = Na__LeCfg__Val('Dimensions', 'AllowedTerminators', null);
        const extMm = Na__LeCfg__Num('Dimensions', 'DefaultExtensionMm', null);
        return {
            inferenceRadiusPx : Na__LeCfg__Num('Dimensions', 'InferenceRadiusPx', 10),
            defaultTextSizeMm : Na__LeCfg__Num('Dimensions', 'DefaultTextSizeMm', 2.5),
            minTextSizeMm     : Na__LeCfg__Num('Dimensions', 'MinTextSizeMm', 1.5),
            maxTextSizeMm     : Na__LeCfg__Num('Dimensions', 'MaxTextSizeMm', 8),
            defaultColour     : Na__LeCfg__Val('Dimensions', 'DefaultColour', '#172b3a'),
            terminators       : Array.isArray(terms) ? terms : [ 'tick', 'arrow', 'dot' ],
            defaultTerminator : Na__LeCfg__Val('Dimensions', 'DefaultTerminator', 'tick'),
            defaultOffsetMm   : Na__LeCfg__Num('Dimensions', 'DefaultOffsetMm', 8),
            extGapMm          : Na__LeCfg__Num('Dimensions', 'ExtensionGapMm', 1.5),
            overshootMm       : Na__LeCfg__Num('Dimensions', 'ExtensionOvershootMm', 1.5),
            defaultExtensionMm : (extMm !== null && extMm >= 0) ? extMm : null,   // <-- How far a new dimension's extension lines run back from its line; null is the full line
            tickLengthMm      : Na__LeCfg__Num('Dimensions', 'TickLengthMm', 1.5),
            minTickLengthMm   : Na__LeCfg__Num('Dimensions', 'MinTickLengthMm', 0.5),
            maxTickLengthMm   : Na__LeCfg__Num('Dimensions', 'MaxTickLengthMm', 12),
            strokeMm          : Na__LeCfg__Num('Dimensions', 'StrokeMm', 0.25),
            textGapMm         : Na__LeCfg__Num('Dimensions', 'TextGapMm', 0.8),
            defaultPrecision  : Na__LeCfg__Num('Dimensions', 'DefaultPrecision', 0),
            defaultUnits      : Na__LeCfg__Val('Dimensions', 'DefaultUnitsSuffix', ' mm'),
            thousandsSep      : Na__LeCfg__Val('Dimensions', 'ThousandsSeparator', ','),
            defaultAtScale    : Na__LeCfg__Val('Dimensions', 'DefaultAtScale', true) !== false,   // <-- Measure at scale: a new dimension reads the drawing's real size
            textLeaderMinMm   : Math.max(0, Na__LeCfg__Num('Dimensions', 'TextLeaderMinMm', 1.5)),
            textLeaderGapMm   : Math.max(0, Na__LeCfg__Num('Dimensions', 'TextLeaderGapMm', 0.4))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Selection Setup (hit tolerance, drag threshold, grip size, the selection box)
    // ------------------------------------------------------------
    // boxStartPx is how far on screen a press travels before it becomes a box,
    // so a click that wobbles on bare paper still only clears the selection.
    // pickDragPx is the same idea for a press that PICKS: the press that
    // selects something, and the second press of a double click (known by
    // doubleClickMs and doubleClickSlopPx), has to travel that far on screen
    // before it moves anything, so a pick never nudges and a double click
    // always steps inside.
    // ------------------------------------------------------------
    function Na__LeCfg__GetSelectionSetup() {
        return {
            hitToleranceMm  : Na__LeCfg__Num('Selection', 'HitToleranceMm', 1.5),
            dragThresholdMm : Na__LeCfg__Num('Selection', 'DragThresholdMm', 0.5),
            pickDragPx        : Math.max(0, Na__LeCfg__Num('Selection', 'PickDragPx', 8)),
            doubleClickMs     : Math.max(0, Na__LeCfg__Num('Selection', 'DoubleClickMs', 500)),
            doubleClickSlopPx : Math.max(0, Na__LeCfg__Num('Selection', 'DoubleClickSlopPx', 6)),
            gripSizePx      : Na__LeCfg__Num('Selection', 'GripSizePx', 9),
            gripSizePickedPx: Math.max(1, Na__LeCfg__Num('Selection', 'GripSizePickedPx', 13)),   // <-- A point you have hold of is drawn larger than one you could take
            boxStartPx      : Math.max(1, Na__LeCfg__Num('Selection', 'BoxStartPx', 4)),
            boxBorderPx     : Math.max(0.5, Na__LeCfg__Num('Selection', 'BoxBorderPx', 1)),
            boxPreview      : Na__LeCfg__Val('Selection', 'BoxPreview', true) !== false,
            boxPreviewPadMm : Math.max(0, Na__LeCfg__Num('Selection', 'BoxPreviewPadMm', 0.8))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Edit Scope Setup (the fade, and whether moving needs the Move tool)
    // ------------------------------------------------------------
    // fadeOpacity is how far back the rest of the sheet drops while a vector or
    // a group is open for editing. moveToolRequired is the safety catch: with
    // it on, a whole object only travels under the Move tool, so a stray drag
    // with Select moves nothing at all. autoMoveOnSelect is what keeps the
    // catch from being a chore: a Select press on one of autoMoveKinds picks
    // the Move tool up by itself, and everything NOT listed - viewports and
    // dimensions, by default - still waits for M.
    // ------------------------------------------------------------
    function Na__LeCfg__GetEditScopeSetup() {
        const kinds = Na__LeCfg__Val('EditScope', 'AutoMoveKinds', null);
        return {
            fadeOpacity      : Na__LeCfg__Unit('EditScope', 'FadeOpacity', 0.25),
            gripToleranceFactor : Math.max(1, Na__LeCfg__Num('EditScope', 'GripToleranceFactor', 2)),
            grabRadiusPx        : Math.max(1, Na__LeCfg__Num('EditScope', 'GrabRadiusPx', 14)),
            moveToolRequired : Na__LeCfg__Val('EditScope', 'MoveToolRequired', true) !== false,
            autoMoveOnSelect : Na__LeCfg__Val('EditScope', 'AutoMoveOnSelect', true) !== false,
            autoMoveKinds    : Array.isArray(kinds) ? kinds : [ 'annotation', 'shape', 'leader', 'group' ]
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Vector Shape Defaults
    // ------------------------------------------------------------
    function Na__LeCfg__GetShapeSetup() {
        return {
            defaultStrokeColour : Na__LeCfg__Val('Shapes', 'DefaultStrokeColour', '#172b3a'),
            defaultStrokePt     : Na__LeCfg__Num('Shapes', 'DefaultStrokePt', 0.20),
            defaultStroked      : Na__LeCfg__Val('Shapes', 'DefaultStroked', true) !== false,
            defaultFillColour   : Na__LeCfg__Val('Shapes', 'DefaultFillColour', '#e4e8ec'),
            defaultFilled       : Na__LeCfg__Val('Shapes', 'DefaultFilled', false) === true,
            defaultFillOpacity  : Na__LeCfg__Unit('Shapes', 'DefaultFillOpacity', 1),
            transparentEdgeOpacity : Na__LeCfg__Unit('Shapes', 'TransparentEdgeOpacity', 0.5),   // <-- Where the edge opacity starts when Transparent edges is ticked
            closeRadiusPx       : Na__LeCfg__Num('Shapes', 'CloseRadiusPx', 10),
            defaultAtScale      : Na__LeCfg__Val('Shapes', 'DefaultAtScale', true) !== false   // <-- Draw at scale: sizes typed while drawing are real sizes at the drawing's scale
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Measurements Box Setup
    // ------------------------------------------------------------
    // The box at the bottom right of the stage (Na__LayoutEditor__Measurements__).
    // precision is the decimal places a reading shows, trailing zeros dropped;
    // pairJoin goes between a rectangle's width and height; hintMs is how long
    // a message above the box stays; edgeGapPx keeps it clear of the scrollbars.
    // ------------------------------------------------------------
    function Na__LeCfg__GetMeasureSetup() {
        const units = Na__LeCfg__Val('Measurements', 'UnitsSuffix', ' mm');
        const join  = Na__LeCfg__Val('Measurements', 'PairSeparator', ' x ');
        return {
            enabled     : Na__LeCfg__Val('Measurements', 'Enabled', true) !== false,
            precision   : Math.max(0, Math.min(3, Math.round(Na__LeCfg__Num('Measurements', 'Precision', 1)))),
            unitsSuffix : typeof units === 'string' ? units : ' mm',
            pairJoin    : typeof join === 'string' ? join : ' x ',
            hintMs      : Math.max(500, Na__LeCfg__Num('Measurements', 'HintMs', 2800)),
            edgeGapPx   : Math.max(0, Na__LeCfg__Num('Measurements', 'EdgeGapPx', 10))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Leader and Specification Bubble Setup
    // ------------------------------------------------------------
    // The settings a new leader starts with, and the rules every leader is
    // drawn by (Na__LayoutEditor__LeaderGeometry__). Weights are printed points
    // like every other line on a sheet; sizes and distances are paper
    // millimetres; opacities run from 0 (clear) to 1 (solid).
    // transparentOpacity is where a leader's line opacity starts when
    // Transparent lines is ticked, so the tick shows a change at once.
    // ------------------------------------------------------------
    function Na__LeCfg__GetLeaderSetup() {
        return {
            defaultType        : Na__LeCfg__Choice('Leader', 'DefaultType', [ 'text', 'bubble' ], 'bubble'),
            defaultText        : Na__LeCfg__Val('Leader', 'DefaultText', 'Note'),
            defaultBubbleText  : Na__LeCfg__Val('Leader', 'DefaultBubbleText', 'EE01'),
            bubbleTextRule     : Na__LeCfg__Choice('Leader', 'BubbleTextRule', [ 'increment', 'repeat', 'fixed' ], 'increment'),
            textSizeMm         : Na__LeCfg__Num('Leader', 'TextSizeMm', 2.5),
            minTextSizeMm      : Na__LeCfg__Num('Leader', 'MinTextSizeMm', 1.5),
            maxTextSizeMm      : Na__LeCfg__Num('Leader', 'MaxTextSizeMm', 14),
            textSizeStepMm     : Na__LeCfg__Num('Leader', 'TextSizeStepMm', 0.25),
            fontWeight         : Na__LeCfg__Num('Leader', 'FontWeight', 600),
            textColour         : Na__LeCfg__Val('Leader', 'TextColour', '#172b3a'),
            lineColour         : Na__LeCfg__Val('Leader', 'LineColour', '#172b3a'),
            linePt             : Na__LeCfg__Num('Leader', 'LinePt', 0.35),
            lineStyle          : Na__LeCfg__Choice('Leader', 'LineStyle', [ 'solid', 'dashed' ], 'dashed'),
            dashMm             : Math.max(0.1, Na__LeCfg__Num('Leader', 'DashMm', 0.8)),
            lineOpacity        : Na__LeCfg__Unit('Leader', 'LineOpacity', 1),
            transparentOpacity : Na__LeCfg__Unit('Leader', 'TransparentOpacity', 0.5),
            endpointFilled     : Na__LeCfg__Val('Leader', 'EndpointFilled', false) === true,
            endpointPt         : Na__LeCfg__Num('Leader', 'EndpointPt', 0.35),
            endpointSizeMm     : Na__LeCfg__Num('Leader', 'EndpointSizeMm', 1.6),
            bubbleSizeMm       : Na__LeCfg__Num('Leader', 'BubbleSizeMm', 9),
            bubbleEdgePt       : Na__LeCfg__Num('Leader', 'BubbleEdgePt', 0.35),
            bubblePaddingMm    : Na__LeCfg__Num('Leader', 'BubblePaddingMm', 1.2),
            filled             : Na__LeCfg__Val('Leader', 'Filled', true) !== false,
            fillColour         : Na__LeCfg__Val('Leader', 'FillColour', '#f2f4f5'),
            fillOpacity        : Na__LeCfg__Unit('Leader', 'FillOpacity', 1),
            textGapMm          : Math.max(0, Na__LeCfg__Num('Leader', 'TextGapMm', 1)),
            textPaddingMm      : Math.max(0, Na__LeCfg__Num('Leader', 'TextPaddingMm', 1)),
            lineSpacing        : Math.max(1, Na__LeCfg__Num('Leader', 'LineSpacing', 1.3)),
            textAttach         : Na__LeCfg__Choice('Leader', 'TextAttach', [ 'first-line', 'middle' ], 'first-line'),
            stubMm             : Math.max(0, Na__LeCfg__Num('Leader', 'StubMm', 3)),
            stubMaxFraction    : Math.max(0, Math.min(0.5, Na__LeCfg__Num('Leader', 'StubMaxFraction', 0.25))),
            curveTension       : Math.max(0, Math.min(1, Na__LeCfg__Num('Leader', 'CurveTension', 0.5))),
            minLengthMm        : Math.max(0.5, Na__LeCfg__Num('Leader', 'MinLengthMm', 2))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Eyedropper Setup (match properties between two items)
    // ------------------------------------------------------------
    // stayLoaded is the one that changes how the tool feels: with it on the
    // picked style stays on the dropper so a run of items costs one click
    // each, which is the whole point of the tool. copyOffset is off because a
    // dimension's offset is where its line sits, so copying it moves the
    // target rather than restyling it.
    // ------------------------------------------------------------
    function Na__LeCfg__GetEyedropperSetup() {
        return {
            stayLoaded         : Na__LeCfg__Val('Eyedropper', 'StayLoadedAfterApply', true) !== false,
            copyOffset         : Na__LeCfg__Val('Eyedropper', 'CopyDimensionOffset', false) === true,
            highlightPadMm     : Na__LeCfg__Num('Eyedropper', 'HighlightPadMm', 1.2),
            highlightBorderPx  : Na__LeCfg__Num('Eyedropper', 'HighlightBorderPx', 1.5),
            cursor             : Na__LeCfg__Val('Eyedropper', 'Cursor', 'copy'),
            applyCursor        : Na__LeCfg__Val('Eyedropper', 'ApplyCursor', 'alias'),
            refuseCursor       : Na__LeCfg__Val('Eyedropper', 'RefuseCursor', 'not-allowed'),
            paletteSwitchesTool : Na__LeCfg__Val('Eyedropper', 'PaletteSwitchesTool', true) !== false,
            flashMs            : Math.max(0, Na__LeCfg__Num('Eyedropper', 'FlashMs', 700))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Viewport Clipboard Setup (copy, paste and duplicate a viewport)
    // ------------------------------------------------------------
    // pasteOffsetMm is the diagonal step a paste takes clear of the viewport or
    // vector it was copied from when it lands on the same sheet; never under a
    // millimetre, or a paste would sit invisibly on top of its original.
    // copySnapshot lets a 3D copy show the stored picture at once instead of
    // rendering it again.
    // ------------------------------------------------------------
    function Na__LeCfg__GetClipboardSetup() {
        return {
            pasteOffsetMm : Math.max(1, Na__LeCfg__Num('Clipboard', 'PasteOffsetMm', 10)),
            copySnapshot  : Na__LeCfg__Val('Clipboard', 'CopySnapshot', true) !== false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Object Snap Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetSnappingSetup() {
        return {
            enabled      : Na__LeCfg__Val('Snapping', 'Enabled', true) !== false,
            radiusPx     : Na__LeCfg__Num('Snapping', 'RadiusPx', 10),
            endpoints    : Na__LeCfg__Val('Snapping', 'Endpoints', true) !== false,
            midpoints    : Na__LeCfg__Val('Snapping', 'Midpoints', true) !== false,
            hiddenLines  : Na__LeCfg__Val('Snapping', 'HiddenLines', false) === true,
            sheetObjects : Na__LeCfg__Val('Snapping', 'SheetObjects', true) !== false,
            markerSizePx : Na__LeCfg__Num('Snapping', 'MarkerSizePx', 10),

            // VIEWPORT CARRY (Na__LayoutEditor__ViewportSnapMove__): press on a
            // viewport's own linework point to move the viewport by it, and rest
            // on another drawing's point to line the move up with it.
            viewportCarry     : Na__LeCfg__Val('Snapping', 'ViewportCarry', true) !== false,
            viewportTracking  : Na__LeCfg__Val('Snapping', 'ViewportTracking', true) !== false,
            acquireDwellMs    : Math.max(0, Na__LeCfg__Num('Snapping', 'AcquireDwellMs', 400)),
            acquireMax        : Math.max(1, Math.round(Na__LeCfg__Num('Snapping', 'AcquireMax', 3))),
            trackMarkerSizePx : Na__LeCfg__Num('Snapping', 'TrackMarkerSizePx', 11)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Config State Tool Setup
    // ------------------------------------------------------------
    export {
        Na__LeCfg__GetTextSetup,
        Na__LeCfg__GetDimensionSetup,
        Na__LeCfg__GetSelectionSetup,
        Na__LeCfg__GetEditScopeSetup,
        Na__LeCfg__GetShapeSetup,
        Na__LeCfg__GetMeasureSetup,
        Na__LeCfg__GetLeaderSetup,
        Na__LeCfg__GetEyedropperSetup,
        Na__LeCfg__GetClipboardSetup,
        Na__LeCfg__GetSnappingSetup
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
