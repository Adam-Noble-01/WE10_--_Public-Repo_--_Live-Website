// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CONFIG STATE
// =============================================================================
//
// FILE       : Na__LayoutEditor__ConfigState__.js
// NAMESPACE  : Na__LeCfg
// MODULE     : Layout Editor - Config State
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the Layout Editor config fetch and expose every tuned value
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Fetches Na__LayoutEditor__AppConfig__.json exactly once and answers every
//   setting the sheet, the panels, the viewports and the PDF exporter ask
//   for. Na__AppConfig__Main.json supplies the web read-only guard.
// - The fallbacks mirror the shipped JSON, so a failed fetch degrades to a
//   working editor rather than a broken one.
//
// INTEGRATION:
// - index.html calls SetAppConfig then Ready before the mode controller
//   initialises; every other module in this folder reads through the getters.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__ConfigState__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.20.0
// - GetViewportSetup: imageZoomMin and imageZoomMax (a 3D picture's zoom
//   limits, 0.25 and 10), imageZoomFineFactor (a Shift+wheel notch against a
//   plain one, 0.2) and imageZoomCommitMs (how long the wheel rests before a
//   run of notches is announced as one undo step, 350).
//
// 14-Sep-2026 - Version 1.19.0
// - GetMarginNotesSetup: body text is TextSizeMm (2 mm). TextSizePt is gone.
//
// 14-Sep-2026 - Version 1.18.0
// - GetMarginNotesSetup: paddingRightMm (clearance before the right border)
//   and body size from TextSizePt (9 pt) converted with PtToMm.
//
// 14-Sep-2026 - Version 1.17.0
// - GetMarginNotesSetup: codePipe (the delimiter between a note's code and
//   its title), rulePt and ruleColour (the faint rule between notes).
//
// 14-Sep-2026 - Version 1.16.0
// - GetScaleSetup carries the site plan scales: sitePlanDenominators (Scales
//   SitePlanScaleDenominators, else 1:500 and 1:1250) and sitePlanDefaultDenominator.
//
// 14-Sep-2026 - Version 1.15.0
// - GetPlanDoorsSetup: shutOnElevations, whether elevation and section
//   viewports draw every door shut whatever the 3D view shows
//   (Na__LayoutEditor__PlanDoors__).
//
// 14-Sep-2026 - Version 1.14.0
// - GetTextSetup: lineSpacing, a sheet annotation's line height as a
//   multiple of its text size (Text LineSpacing).
//
// 14-Sep-2026 - Version 1.13.0
// - GetSpecificationSetup: FileName is TrueVision__DrawingNotes__.json (the
//   local and R2 sibling beside the project data). LegacyFileName is the
//   previous R2 name, read only when the new file is not there yet.
//
// 14-Sep-2026 - Version 1.12.0
// - GetDimensionSetup: textLeaderMinMm and textLeaderGapMm, how far a
//   dragged value has to sit from its un-dragged place before the arc is
//   drawn (and before a drag keeps rather than snapping home), and the
//   clear paper between the value's box and the start of that arc.
//
// 14-Sep-2026 - Version 1.11.0
// - GetDimensionSetup: minTickLengthMm and maxTickLengthMm, the bounds of the
//   Dimensions panel's Size mm (how large the ticks, arrows or dots at each
//   end are). TickLengthMm is still the size a dimension without its own
//   Dimension__TickLengthMm draws at, and the size new ones start with.
//
// 14-Sep-2026 - Version 1.10.0
// - GetPlanDoorsSetup: whether plan viewports draw their doors open, with
//   swing arcs and at what arc step, whether a click on a door closes or opens
//   it, and how long a click waits to rule out a double click
//   (Na__LayoutEditor__PlanDoors__).
//
// 14-Sep-2026 - Version 1.9.0
// - GetDimensionSetup: defaultExtensionMm, the extension line length new
//   dimensions start with (Dimensions DefaultExtensionMm). Null - the default -
//   and anything below zero draw the full line.
//
// 14-Sep-2026 - Version 1.8.0
// - GetMeasureSetup: the Measurements box's reading precision, units suffix,
//   pair separator, message time and scrollbar gap
//   (Na__LayoutEditor__Measurements__).
// - GetMeasureKeys: the keys the box reads, from the key map's MeasurementsBox
//   block - the characters that start and continue a value, and the keys that
//   use, drop and take back what is typed.
// - GetShapeSetup and GetDimensionSetup carry defaultAtScale: Draw at scale and
//   Measure at scale, on unless the config switches them off.
//
// 14-Sep-2026 - Version 1.7.0
// - GetSpecificationSetup: the project specification file, how its codes are
//   numbered, its browser draft and undo depth, the cloud overwrite question
//   and the starter groups offered to an empty specification
//   (Na__LayoutEditor__SpecData__).
// - GetMarginNotesSetup: the notes margin a sheet can carry - its width
//   limits, padding, heading, text sizes, spacing, divider and edge grip
//   (Na__LayoutEditor__SpecMargin__).
//
// 14-Sep-2026 - Version 1.6.0
// - Box select: the Selection setup carries the box's start distance, edge
//   weight and preview (BoxStartPx, BoxBorderPx, BoxPreview, BoxPreviewPadMm),
//   and MatchSelectionModifier reads the key map's SelectionBindings: Ctrl
//   adds, Shift toggles, Ctrl+Shift removes, and Alt starts a box anywhere.
//
// 14-Sep-2026 - Version 1.5.0
// - GetLeaderSetup: what a new leader or specification bubble starts with
//   (type, text, line, endpoint, bubble, fill and opacities) and the rules
//   every leader is drawn by (stubs, curve tension, text gap, padding, line
//   spacing, where the line lands on a note). Unit and Choice read an opacity
//   and a fixed word safely.
// - GetShapeSetup carries DefaultFillOpacity and TransparentEdgeOpacity.
// - The E key (Tool__Leader) in the key map fallback.
//
// 13-Sep-2026 - Version 1.4.0
// - GetModelSourceSetup: how many design phases stay loaded off-scene for
//   viewports that draw a phase the 3D view does not hold (TrueVision).
//
// 13-Sep-2026 - Version 1.3.0
// - The Shift+B palette binding in the key map fallback; PaletteSwitchesTool and
//   FlashMs in the eyedropper setup.
//
// 10-Sep-2026 - Version 1.2.0
// - Sheet setup carries BlockGapMm; style setup carries the frame caption and
//   title block weights, tracking and uppercasing; title block setup carries
//   the logo's printed width, height cap, aspect and paddings and the field
//   paddings. The old LogoPaddingMm and ValueOffsetBottomMm keys are gone.
//
// 10-Sep-2026 - Version 1.1.0
// - Owns Na__LayoutEditor__KeyMappings__.json as well, and answers what a
//   button, a wheel turn or a key press means. The control modules and the
//   sheet tools resolve every binding through here, so no input is written
//   into code any more.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Key Shape
    // ------------------------------------------------------------
    const Na__LeCfg__ConfigUrl  = new URL('./Na__LayoutEditor__AppConfig__.json', import.meta.url);
    const Na__LeCfg__KeyMapUrl  = new URL('./Na__LayoutEditor__KeyMappings__.json', import.meta.url);
    const Na__LeCfg__PREFIX     = 'LayoutEditor__';
    const Na__LeCfg__MAIN_BLOCK = 'LayoutEditor__Config';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Fallbacks (mirror the shipped JSON)
    // ------------------------------------------------------------
    const Na__LeCfg__FALLBACKS = Object.freeze({
        paperSizes : { A4 : { Label : 'A4', WidthMm : 297, HeightMm : 210 }, A3 : { Label : 'A3', WidthMm : 420, HeightMm : 297 },
                       A2 : { Label : 'A2', WidthMm : 594, HeightMm : 420 }, A1 : { Label : 'A1', WidthMm : 841, HeightMm : 594 } },
        rows       : [ { Key : 'Client', Label : 'Client', WidthMm : 30 }, { Key : 'SiteAddress', Label : 'Site Address', WidthMm : 50 },
                       { Key : 'Title', Label : 'Drawing Title', WidthMm : 40 }, { Key : 'DrawingNumber', Label : 'Drawing No.', WidthMm : 18 },
                       { Key : 'Revision', Label : 'Rev', WidthMm : 8 }, { Key : 'Scale', Label : 'Scale', WidthMm : 20 },
                       { Key : 'Date', Label : 'Date', WidthMm : 16 }, { Key : 'DrawnBy', Label : 'Drawn By', WidthMm : 20 } ],
        scales     : [ 20, 50, 100 ]
    });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Key Map Fallback (mirrors the enabled defaults in the shipped JSON)
    // ------------------------------------------------------------
    // Only the bindings that ship switched on are repeated here. A failed
    // fetch therefore still leaves a sheet that zooms and pans exactly the
    // way Lantern Designer does, rather than one that cannot be moved.
    const Na__LeCfg__KEYMAP_FALLBACK = Object.freeze({
        guards   : { pointerIgnoreSelector   : 'input, select, button, textarea, canvas, [contenteditable="true"]',
                     wheelIgnoreSelector     : 'canvas',
                     contextMenuKeepSelector : 'input, select, button, textarea, [contenteditable="true"]',
                     paperSelector           : '.na-le-paper' },
        pointer  : [ { Id : 'Pan__MiddleOrRightDrag', Action : 'Nav__Pan', Enabled : true, Buttons : [ 'Middle', 'Right' ], Modifiers : [], ModifierMatch : 'Any' } ],
        wheel    : [ { Id : 'Zoom__Wheel', Action : 'Nav__ZoomAtCursor', Enabled : true, Modifiers : [], ModifierMatch : 'Any' } ],
        keyboard : [ { Id : 'Edit__Cancel',      Action : 'Edit__Cancel',      Enabled : true, Keys : [ 'Escape' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Delete',      Action : 'Edit__Delete',      Enabled : true, Keys : [ 'Delete', 'Backspace' ],  Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__NudgeLeft',   Action : 'Edit__NudgeLeft',   Enabled : true, Keys : [ 'ArrowLeft' ],            Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Edit__NudgeRight',  Action : 'Edit__NudgeRight',  Enabled : true, Keys : [ 'ArrowRight' ],           Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Edit__NudgeUp',     Action : 'Edit__NudgeUp',     Enabled : true, Keys : [ 'ArrowUp' ],              Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Edit__NudgeDown',   Action : 'Edit__NudgeDown',   Enabled : true, Keys : [ 'ArrowDown' ],            Modifiers : [], ModifierMatch : 'CoarseOptional' },
                     { Id : 'Tool__Select',      Action : 'Tool__Select',      Enabled : true, Keys : [ 'v', 'V' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Text',        Action : 'Tool__Text',        Enabled : true, Keys : [ 't', 'T' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Dimension',   Action : 'Tool__Dimension',   Enabled : true, Keys : [ 'd', 'D' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Snap__Toggle',      Action : 'Snap__Toggle',      Enabled : true, Keys : [ 'F3' ],                   Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Undo',        Action : 'Edit__Undo',        Enabled : true, Keys : [ 'z', 'Z' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Redo',        Action : 'Edit__Redo',        Enabled : true, Keys : [ 'y', 'Y' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__RedoShift',   Action : 'Edit__Redo',        Enabled : true, Keys : [ 'z', 'Z' ],               Modifiers : [ 'Ctrl', 'Shift' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Deselect',    Action : 'Edit__Deselect',    Enabled : true, Keys : [ ' ' ],                    Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Finish',      Action : 'Edit__Finish',      Enabled : true, Keys : [ 'Enter' ],                Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Draw',        Action : 'Tool__Draw',        Enabled : true, Keys : [ 'l', 'L' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Rectangle',   Action : 'Tool__Rectangle',   Enabled : true, Keys : [ 'r', 'R' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Leader',      Action : 'Tool__Leader',      Enabled : true, Keys : [ 'e', 'E' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Tool__EyedropperPalette', Action : 'Tool__EyedropperPalette', Enabled : true, Keys : [ 'b', 'B' ], Modifiers : [ 'Shift' ], ModifierMatch : 'Exact' },
                     { Id : 'Tool__Eyedropper',  Action : 'Tool__Eyedropper',  Enabled : true, Keys : [ 'b', 'B' ],               Modifiers : [], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Ungroup',     Action : 'Edit__Ungroup',     Enabled : true, Keys : [ 'g', 'G' ],               Modifiers : [ 'Ctrl', 'Shift' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Group',       Action : 'Edit__Group',       Enabled : true, Keys : [ 'g', 'G' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Copy',        Action : 'Edit__Copy',        Enabled : true, Keys : [ 'c', 'C' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Paste',       Action : 'Edit__Paste',       Enabled : true, Keys : [ 'v', 'V' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' },
                     { Id : 'Edit__Duplicate',   Action : 'Edit__Duplicate',   Enabled : true, Keys : [ 'd', 'D' ],               Modifiers : [ 'Ctrl' ], ModifierMatch : 'Exact' } ],
        keyboardSetup : { ignoreWhenTyping : true, coarseStepModifier : 'Shift', nudgeStepMm : 1, nudgeCoarseStepMm : 10,
                          panStepPx : 60, panCoarseStepPx : 240, zoomKeyStep : 1.15 },
        touch    : { oneFingerPanOnStage : true, oneFingerPanOnPaper : false, twoFingerPan : true, pinchZoom : true,
                     doubleTapFit : true, doubleTapWindowMs : 320, doubleTapSlopPx : 24, panStartSlopPx : 6, pinchStartSlopPx : 8 },
        selection : { list : [ { Id : 'Select__Remove', Action : 'Select__Remove', Enabled : true, Modifiers : [ 'Ctrl', 'Shift' ], ModifierMatch : 'Exact' },
                               { Id : 'Select__Add',    Action : 'Select__Add',    Enabled : true, Modifiers : [ 'Ctrl' ],          ModifierMatch : 'Exact' },
                               { Id : 'Select__Toggle', Action : 'Select__Toggle', Enabled : true, Modifiers : [ 'Shift' ],         ModifierMatch : 'Exact' } ],
                      boxAnywhereModifier : 'Alt' },
        measure   : { start : '0123456789.,-', typing : '0123456789.,-+ xX*;mMcC', commit : [ 'Enter' ], clear : [ 'Escape', 'Delete' ], erase : [ 'Backspace' ] }
    });
    // ------------------------------------------------------------

    // MODULE VARIABLES | Parsed Configs and Fetch Promise
    // ------------------------------------------------------------
    let Na__LeCfg__Config      = null;
    let Na__LeCfg__AppConfig   = null;
    let Na__LeCfg__KeyMap      = null;
    let Na__LeCfg__LoadPromise = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Config Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Value From a Block (fallback when absent)
    // ------------------------------------------------------------
    function Na__LeCfg__Val(blockName, keyName, fallback) {
        const block = Na__LeCfg__Config ? Na__LeCfg__Config[Na__LeCfg__PREFIX + blockName + '__Config'] : null;
        const value = block ? block[Na__LeCfg__PREFIX + blockName + '__' + keyName] : undefined;
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Finite Number, or the Fallback
    // ------------------------------------------------------------
    function Na__LeCfg__Num(blockName, keyName, fallback) {
        const value = Na__LeCfg__Val(blockName, keyName, undefined);
        return (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read an Opacity (0 clear to 1 solid), or the Fallback
    // ------------------------------------------------------------
    function Na__LeCfg__Unit(blockName, keyName, fallback) {
        return Math.max(0, Math.min(1, Na__LeCfg__Num(blockName, keyName, fallback)));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read One of a Fixed Set of Words, or the Fallback
    // ------------------------------------------------------------
    function Na__LeCfg__Choice(blockName, keyName, allowed, fallback) {
        const value = Na__LeCfg__Val(blockName, keyName, fallback);
        return allowed.indexOf(value) === -1 ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch the System JSON Once
    // ------------------------------------------------------------
    async function Na__LeCfg__Fetch() {
        try {
            const response = await fetch(Na__LeCfg__ConfigUrl, { cache : 'no-store' });
            if (!response.ok) {
                console.warn('[TrueVision3D LayoutEditor] Config fetch failed (' + response.status + ') - using built-in defaults.');
                return false;
            }
            Na__LeCfg__Config = await response.json();
            return true;
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] Config unreadable - using built-in defaults.', error);
            return false;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch the Key Map JSON Once
    // ------------------------------------------------------------
    async function Na__LeCfg__FetchKeyMap() {
        try {
            const response = await fetch(Na__LeCfg__KeyMapUrl, { cache : 'no-store' });
            if (!response.ok) {
                console.warn('[TrueVision3D LayoutEditor] Key map fetch failed (' + response.status + ') - using built-in bindings.');
                return false;
            }
            Na__LeCfg__KeyMap = await response.json();
            return true;
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] Key map unreadable - using built-in bindings.', error);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Loading and Guards
// -----------------------------------------------------------------------------

    // FUNCTION | Hand the Main App Config In
    // ------------------------------------------------------------
    function Na__LeCfg__SetAppConfig(appConfig) {
        Na__LeCfg__AppConfig = (appConfig && typeof appConfig === 'object') ? appConfig : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Load the System Config Exactly Once
    // ------------------------------------------------------------
    function Na__LeCfg__Ready() {
        if (!Na__LeCfg__LoadPromise) {
            Na__LeCfg__LoadPromise = Promise.all([ Na__LeCfg__Fetch(), Na__LeCfg__FetchKeyMap() ])
                .then((results) => results[0]);                                // <-- The key map degrades to its own fallback
        }
        return Na__LeCfg__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether the Layout Editor Is Switched On
    // ------------------------------------------------------------
    function Na__LeCfg__IsEnabled() {
        if (!Na__LeCfg__Config) return true;
        return Na__LeCfg__Config[Na__LeCfg__PREFIX + 'Enabled'] !== false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether the Web Build Is Read-Only (Main.json guard)
    // ------------------------------------------------------------
    function Na__LeCfg__IsReadOnlyOnWeb() {
        const main = Na__LeCfg__AppConfig ? Na__LeCfg__AppConfig[Na__LeCfg__MAIN_BLOCK] : null;
        return !main || main['LayoutEditor__Config__ReadOnlyOnWeb'] !== false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Setup Blocks
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Paper Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetSheetSetup() {
        const sizes = Na__LeCfg__Val('Sheet', 'PaperSizes', null);
        return {
            defaultPaperSize   : Na__LeCfg__Val('Sheet', 'DefaultPaperSize', 'A3'),
            defaultOrientation : Na__LeCfg__Val('Sheet', 'DefaultOrientation', 'landscape'),
            marginMm           : Na__LeCfg__Num('Sheet', 'MarginMm', 5),
            blockGapMm         : Na__LeCfg__Num('Sheet', 'BlockGapMm', 3),
            borderStrokeMm     : Na__LeCfg__Num('Sheet', 'BorderStrokeMm', 0.5),
            screenPixelsPerMm  : Na__LeCfg__Num('Sheet', 'ScreenPixelsPerMm', 3.2),
            defaultNameFormat  : Na__LeCfg__Val('Sheet', 'DefaultNameFormat', 'Drawing {index}'),
            paperSizes         : (sizes && typeof sizes === 'object') ? sizes : Na__LeCfg__FALLBACKS.paperSizes
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Sheet Style (chrome painting)
    // ------------------------------------------------------------
    function Na__LeCfg__GetStyleSetup() {
        return {
            fontFamily        : Na__LeCfg__Val('Style', 'FontFamily', "Helvetica, Arial, 'Open Sans', sans-serif"),
            paperColour       : Na__LeCfg__Val('Style', 'PaperColour', '#ffffff'),
            inkColour         : Na__LeCfg__Val('Style', 'InkColour', '#172b3a'),
            frameLineColour   : Na__LeCfg__Val('Style', 'FrameLineColour', '#8a949c'),
            mutedTextColour   : Na__LeCfg__Val('Style', 'MutedTextColour', '#6c757d'),
            selectionColour   : Na__LeCfg__Val('Style', 'SelectionColour', '#336699'),
            frameStrokeMm     : Na__LeCfg__Num('Style', 'FrameStrokeMm', 0.25),
            frameLabelFontMm  : Na__LeCfg__Num('Style', 'FrameLabelFontMm', 2.4),
            frameLabelHeightMm: Na__LeCfg__Num('Style', 'FrameLabelHeightMm', 5),
            cellPaddingMm     : Na__LeCfg__Num('Style', 'CellPaddingMm', 1.9),

            frameLabelWeight    : Na__LeCfg__Val('Style', 'FrameLabelWeight', 'bold'),
            frameLabelTrackingMm: Na__LeCfg__Num('Style', 'FrameLabelTrackingMm', 0.16),
            frameLabelUppercase : Na__LeCfg__Val('Style', 'FrameLabelUppercase', true) !== false,
            titleLabelWeight    : Na__LeCfg__Val('Style', 'TitleLabelWeight', 'normal'),
            titleLabelTrackingMm: Na__LeCfg__Num('Style', 'TitleLabelTrackingMm', 0.05),
            titleLabelUppercase : Na__LeCfg__Val('Style', 'TitleLabelUppercase', true) !== false,
            titleValueWeight    : Na__LeCfg__Val('Style', 'TitleValueWeight', 'normal')
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Title Block Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetTitleBlockSetup() {
        const rows    = Na__LeCfg__Val('TitleBlock', 'Rows', null);
        const scans   = Na__LeCfg__Val('TitleBlock', 'ClassicScanAssets', null);
        const anchors = Na__LeCfg__Val('TitleBlock', 'ClassicFieldAnchors', null);
        return {
            defaultStyle        : Na__LeCfg__Val('TitleBlock', 'DefaultStyle', 'modern'),
            heightMm            : Na__LeCfg__Num('TitleBlock', 'HeightMm', 10),
            logoAssetPath       : Na__LeCfg__Val('TitleBlock', 'LogoAssetPath', '../assets__CommonApplicationAssets/AppLogo__ValeHeaderImage_ValeLogo_HorizontalFormat__.png'),
            logoCellWidthMm     : Na__LeCfg__Num('TitleBlock', 'LogoCellWidthMm', 34),
            logoWidthMm         : Na__LeCfg__Num('TitleBlock', 'LogoWidthMm', 33),
            logoMaxHeightMm     : Na__LeCfg__Num('TitleBlock', 'LogoMaxHeightMm', 5.5),
            logoAspect          : Na__LeCfg__Num('TitleBlock', 'LogoAspectWidthOverHeight', 4.096),
            logoPaddingVMm      : Na__LeCfg__Num('TitleBlock', 'LogoPaddingVMm', 1.8),
            logoPaddingHMm      : Na__LeCfg__Num('TitleBlock', 'LogoPaddingHMm', 2.5),
            fontSizeLabelMm     : Na__LeCfg__Num('TitleBlock', 'FontSizeLabelMm', 1.6),
            fontSizeValueMm     : Na__LeCfg__Num('TitleBlock', 'FontSizeValueMm', 2.2),
            fieldPaddingHMm     : Na__LeCfg__Num('TitleBlock', 'FieldPaddingHMm', 1.4),
            fieldPaddingTopMm   : Na__LeCfg__Num('TitleBlock', 'FieldPaddingTopMm', 2.4),
            fieldPaddingBottomMm: Na__LeCfg__Num('TitleBlock', 'FieldPaddingBottomMm', 0.8),
            labelOffsetTopMm    : Na__LeCfg__Num('TitleBlock', 'FieldLabelOffsetTopMm', 1.5),
            drawnByDefault      : Na__LeCfg__Val('TitleBlock', 'DrawnByDefault', 'Noble Architecture'),
            rows                : Array.isArray(rows) ? rows : Na__LeCfg__FALLBACKS.rows,
            classicScanAssets   : (scans && typeof scans === 'object') ? scans : {},
            classicFieldAnchors : (anchors && typeof anchors === 'object') ? anchors : {}
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Scale Setup (D27)
    // ------------------------------------------------------------
    function Na__LeCfg__GetScaleSetup() {
        const list = Na__LeCfg__Val('Scales', 'AvailableScaleDenominators', null);
        const sitePlanList = Na__LeCfg__Val('Scales', 'SitePlanScaleDenominators', null);   // <-- Site plan viewports: 1:500 and 1:1250 unless configured
        return {
            denominators : Array.isArray(list) && list.length ? list.slice().sort((a, b) => a - b) : Na__LeCfg__FALLBACKS.scales.slice(),
            defaultDenominator : Na__LeCfg__Num('Scales', 'DefaultScaleDenominator', 50),
            sitePlanDenominators       : Array.isArray(sitePlanList) && sitePlanList.length ? sitePlanList.slice().sort((a, b) => a - b) : [ 500, 1250 ],
            sitePlanDefaultDenominator : Na__LeCfg__Num('Scales', 'SitePlanDefaultScaleDenominator', 500),
            labelPrefix        : Na__LeCfg__Val('Scales', 'ScaleLabelPrefix', '1:'),
            notToScaleLabel    : Na__LeCfg__Val('Scales', 'NotToScaleLabel', 'NTS')
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Viewport Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetViewportSetup() {
        return {
            defaultWidthMm       : Na__LeCfg__Num('Viewport', 'DefaultWidthMm', 180),
            defaultHeightMm      : Na__LeCfg__Num('Viewport', 'DefaultHeightMm', 120),
            minSizeMm            : Na__LeCfg__Num('Viewport', 'MinSizeMm', 20),
            handleSizePx         : Na__LeCfg__Num('Viewport', 'HandleSizePx', 9),
            handleHitRadiusPx    : Na__LeCfg__Num('Viewport', 'HandleHitRadiusPx', 10),
            showScaleLabel       : Na__LeCfg__Val('Viewport', 'ShowScaleLabel', true) !== false,
            defaultStyles        : Na__LeCfg__DefaultStyles(Na__LeCfg__Val('Viewport', 'DefaultStyles', null)),
            assetFolder          : Na__LeCfg__Val('Viewport', 'AssetFolder', 'LayoutEditor/Snapshots'),
            imageZoomMin         : Math.min(1, Math.max(0.01, Na__LeCfg__Num('Viewport', 'ImageZoomMin', 0.25))),   // <-- A 3D picture's zoom limits: never past 100 percent the wrong way
            imageZoomMax         : Math.max(1, Na__LeCfg__Num('Viewport', 'ImageZoomMax', 10)),
            imageZoomFineFactor  : Math.max(0.01, Na__LeCfg__Num('Viewport', 'ImageZoomFineFactor', 0.2)),
            imageZoomCommitMs    : Math.max(0, Na__LeCfg__Num('Viewport', 'ImageZoomCommitMs', 350))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Sheet Text Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetTextSetup() {
        const weights = Na__LeCfg__Val('Text', 'AllowedWeights', null);
        return {
            fontFamily     : Na__LeCfg__Val('Text', 'FontFamily', "'Open Sans', Helvetica, Arial, sans-serif"),
            defaultSizeMm  : Na__LeCfg__Num('Text', 'DefaultSizeMm', 3),
            minSizeMm      : Na__LeCfg__Num('Text', 'MinSizeMm', 1.5),
            maxSizeMm      : Na__LeCfg__Num('Text', 'MaxSizeMm', 14),
            sizeStepMm     : Na__LeCfg__Num('Text', 'SizeStepMm', 0.5),
            allowedWeights : Array.isArray(weights) ? weights : [ 300, 400, 600 ],
            defaultWeight  : Na__LeCfg__Num('Text', 'DefaultWeight', 400),
            defaultColour  : Na__LeCfg__Val('Text', 'DefaultColour', '#172b3a'),
            defaultText    : Na__LeCfg__Val('Text', 'DefaultText', 'Text'),
            lineSpacing    : Math.max(1, Na__LeCfg__Num('Text', 'LineSpacing', 1.2)),
            leaderStrokeMm : Na__LeCfg__Num('Text', 'LeaderStrokeMm', 0.2)
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


    // HELPER FUNCTION | The Style Toggles a New Viewport Starts With
    // ------------------------------------------------------------
    // Projected linework off by default: laying out a sheet must never cost
    // a projection; it is switched on per viewport once the layout settles.
    // ------------------------------------------------------------
    function Na__LeCfg__DefaultStyles(block) {
        const b = (block && typeof block === 'object') ? block : {};
        const flag = (key, fallback) => (typeof b[key] === 'boolean' ? b[key] : fallback);
        return {
            baseImage         : flag('BaseImage',         true),
            projectedLinework : flag('ProjectedLinework', false),
            profileLinework   : flag('ProfileLinework',   false),
            glassOpaque       : flag('GlassOpaque',       true),
            whitecard         : flag('Whitecard',         true),
            hiddenLines       : flag('HiddenLines',       false),
            enhanceWhitecard  : flag('EnhanceWhitecard',  true),
            contextLayer      : flag('ContextLayer',      true)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | History Depth
    // ------------------------------------------------------------
    function Na__LeCfg__GetHistorySetup() {
        return { maxSteps : Math.max(1, Math.round(Na__LeCfg__Num('History', 'MaxSteps', 50))) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Auto Save and Browser Draft Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetAutoSaveSetup() {
        return {
            enabled      : Na__LeCfg__Val('AutoSave', 'Enabled', true) !== false,
            debounceMs   : Math.max(200, Na__LeCfg__Num('AutoSave', 'DebounceMs', 1500)),
            draftEnabled : Na__LeCfg__Val('AutoSave', 'DraftEnabled', true) !== false,
            draftDebounceMs : Math.max(100, Na__LeCfg__Num('AutoSave', 'DraftDebounceMs', 600))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Raster Levels for the Viewport Pictures
    // ------------------------------------------------------------
    function Na__LeCfg__GetRasterSetup() {
        const block = Na__LeCfg__Val('Raster', 'Levels', null);
        const level = (name, ppm, maxPx, samples) => {
            const spec = (block && typeof block === 'object' && block[name] && typeof block[name] === 'object') ? block[name] : {};
            return {
                pixelsPerMm      : Number.isFinite(spec.PixelsPerMm) && spec.PixelsPerMm > 0 ? spec.PixelsPerMm : ppm,
                maxPixels        : Number.isFinite(spec.MaxPixels)   && spec.MaxPixels   > 0 ? spec.MaxPixels   : maxPx,
                // A record written before supersampling existed has no key here,
                // so the fallback is the level's intended count rather than 1.
                // Falling back to 1 would quietly leave every project on the old
                // aliased picture and look like the feature had not shipped.
                antiAliasSamples : Number.isFinite(spec.AntiAliasSamples) && spec.AntiAliasSamples > 0 ? spec.AntiAliasSamples : samples
            };
        };
        return {
            defaultLevel : Na__LeCfg__Val('Raster', 'DefaultLevel', 'medium'),
            exportLevel  : Na__LeCfg__Val('Raster', 'ExportLevel', 'high'),
            scaleWithDpr : Na__LeCfg__Val('Raster', 'ScaleWithDevicePixelRatio', true) !== false,
            levels       : {
                low    : level('low',     4, 2048,  1),
                medium : level('medium',  8, 4096,  4),
                high   : level('high',   12, 6144, 16)
            }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Points to Paper Millimetres (1 pt = 1/72 inch)
    // ------------------------------------------------------------
    function Na__LeCfg__PtToMm(pt) { return (Number.isFinite(pt) ? pt : 0) * 25.4 / 72; }
    // ------------------------------------------------------------


    // FUNCTION | Selection Setup (hit tolerance, drag threshold, grip size, the selection box)
    // ------------------------------------------------------------
    // boxStartPx is how far on screen a press travels before it becomes a box,
    // so a click that wobbles on bare paper still only clears the selection.
    // ------------------------------------------------------------
    function Na__LeCfg__GetSelectionSetup() {
        return {
            hitToleranceMm  : Na__LeCfg__Num('Selection', 'HitToleranceMm', 1.5),
            dragThresholdMm : Na__LeCfg__Num('Selection', 'DragThresholdMm', 0.5),
            gripSizePx      : Na__LeCfg__Num('Selection', 'GripSizePx', 9),
            boxStartPx      : Math.max(1, Na__LeCfg__Num('Selection', 'BoxStartPx', 4)),
            boxBorderPx     : Math.max(0.5, Na__LeCfg__Num('Selection', 'BoxBorderPx', 1)),
            boxPreview      : Na__LeCfg__Val('Selection', 'BoxPreview', true) !== false,
            boxPreviewPadMm : Math.max(0, Na__LeCfg__Num('Selection', 'BoxPreviewPadMm', 0.8))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Doors on Plan, Elevation and Section Viewports
    // ------------------------------------------------------------
    function Na__LeCfg__GetPlanDoorsSetup() {
        return {
            openOnPlans      : Na__LeCfg__Val('PlanDoors', 'OpenOnPlans', true) !== false,
            shutOnElevations : Na__LeCfg__Val('PlanDoors', 'ShutOnElevations', true) !== false,
            drawSwings       : Na__LeCfg__Val('PlanDoors', 'DrawSwings', true) !== false,
            swingStepDegrees : Math.min(45, Math.max(1, Na__LeCfg__Num('PlanDoors', 'SwingStepDegrees', 5))),
            clickToToggle    : Na__LeCfg__Val('PlanDoors', 'ClickToToggle', true) !== false,
            clickDelayMs     : Math.max(0, Na__LeCfg__Num('PlanDoors', 'ClickDelayMs', 300))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Printed Line Weights in Points
    // ------------------------------------------------------------
    function Na__LeCfg__GetLineweightSetup() {
        return {
            viewportPt  : Na__LeCfg__Num('Lineweights', 'ViewportPt', 0.30),
            dimensionPt : Na__LeCfg__Num('Lineweights', 'DimensionPt', 0.35),
            minPt       : Na__LeCfg__Num('Lineweights', 'MinPt', 0.05),
            maxPt       : Na__LeCfg__Num('Lineweights', 'MaxPt', 3),
            stepPt      : Na__LeCfg__Num('Lineweights', 'StepPt', 0.05)
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


    // FUNCTION | Project Specification Setup
    // ------------------------------------------------------------
    // The file the specification lives in beside the project data
    // (TrueVision__DrawingNotes__.json locally and on R2; LegacyFileName is the
    // previous R2 name, read only when the new file is not there yet), how its
    // codes are numbered, the browser draft, its own undo depth, and the groups
    // offered to a project with no specification yet. A code is a group prefix
    // of up to PrefixMaxLength letters and the note's place in its group,
    // zero-padded to NumberDigits: GN01, EE02.
    // ------------------------------------------------------------
    function Na__LeCfg__GetSpecificationSetup() {
        const starters = Na__LeCfg__Val('Specification', 'StarterGroups', null);
        return {
            fileName         : Na__LeCfg__Val('Specification', 'FileName', 'TrueVision__DrawingNotes__.json'),
            legacyFileName   : Na__LeCfg__Val('Specification', 'LegacyFileName', 'TrueVision__ProjectSpecification__.json'),
            numberDigits     : Math.max(1, Math.min(4, Math.round(Na__LeCfg__Num('Specification', 'NumberDigits', 2)))),
            prefixMaxLength  : Math.max(1, Math.min(6, Math.round(Na__LeCfg__Num('Specification', 'PrefixMaxLength', 4)))),
            draftEnabled     : Na__LeCfg__Val('Specification', 'DraftEnabled', true) !== false,
            draftDebounceMs  : Math.max(100, Na__LeCfg__Num('Specification', 'DraftDebounceMs', 600)),
            historySteps     : Math.max(1, Math.round(Na__LeCfg__Num('Specification', 'HistorySteps', 50))),
            loadTimeoutMs    : Math.max(1000, Na__LeCfg__Num('Specification', 'LoadTimeoutMs', 12000)),
            confirmOverwrite : Na__LeCfg__Val('Specification', 'ConfirmCloudOverwrite', true) !== false,
            starterGroups    : Array.isArray(starters) ? starters : [
                { Prefix : 'GN', Title : 'General Notes',    IsGeneral : true  },
                { Prefix : 'SN', Title : 'Structural Notes', IsGeneral : false },
                { Prefix : 'FN', Title : 'Finishes',         IsGeneral : false }
            ]
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Margin Notes Setup (the notes column down a sheet)
    // ------------------------------------------------------------
    // What a sheet's notes margin starts with, and the rules it is laid out by.
    // Sizes and distances are paper millimetres; the divider is printed points.
    // A margin is never narrower than MinWidthMm nor wider than
    // MaxWidthFraction of the sheet's content width. PaddingRightMm is the
    // extra inset before the right border. Body text is TextSizeMm (2 mm); a
    // note's title is TitleScale times that. CodePipe sits
    // between the code and the title; RulePt and RuleColour draw the line
    // between notes.
    // ------------------------------------------------------------
    function Na__LeCfg__GetMarginNotesSetup() {
        return {
            defaultWidthMm    : Math.max(10, Na__LeCfg__Num('MarginNotes', 'DefaultWidthMm', 90)),
            minWidthMm        : Math.max(10, Na__LeCfg__Num('MarginNotes', 'MinWidthMm', 40)),
            maxWidthFraction  : Math.max(0.1, Math.min(0.9, Na__LeCfg__Num('MarginNotes', 'MaxWidthFraction', 0.6))),
            paddingMm         : Math.max(0, Na__LeCfg__Num('MarginNotes', 'PaddingMm', 3)),
            paddingRightMm    : Math.max(0, Na__LeCfg__Num('MarginNotes', 'PaddingRightMm', 6)),
            headingText       : Na__LeCfg__Val('MarginNotes', 'HeadingText', 'NOTES'),
            headingSizeMm     : Math.max(0.5, Na__LeCfg__Num('MarginNotes', 'HeadingSizeMm', 3.5)),
            headingTrackingMm : Math.max(0, Na__LeCfg__Num('MarginNotes', 'HeadingTrackingMm', 0.2)),
            headingGapMm      : Math.max(0, Na__LeCfg__Num('MarginNotes', 'HeadingGapMm', 3)),
            textSizeMm        : Math.max(0.5, Na__LeCfg__Num('MarginNotes', 'TextSizeMm', 2)),
            minTextSizeMm     : Math.max(0.5, Na__LeCfg__Num('MarginNotes', 'MinTextSizeMm', 1.2)),
            maxTextSizeMm     : Math.max(1, Na__LeCfg__Num('MarginNotes', 'MaxTextSizeMm', 6)),
            titleScale        : Math.max(0.5, Na__LeCfg__Num('MarginNotes', 'TitleScale', 1.1)),
            lineSpacing       : Math.max(1, Na__LeCfg__Num('MarginNotes', 'LineSpacing', 1.35)),
            noteGapMm         : Math.max(0, Na__LeCfg__Num('MarginNotes', 'NoteGapMm', 2.5)),
            codeGapMm         : Math.max(0, Na__LeCfg__Num('MarginNotes', 'CodeGapMm', 2)),
            codePipe          : Na__LeCfg__Val('MarginNotes', 'CodePipe', ' | '),
            groupGapMm        : Math.max(0, Na__LeCfg__Num('MarginNotes', 'GroupGapMm', 2)),
            dividerPt         : Math.max(0, Na__LeCfg__Num('MarginNotes', 'DividerPt', 0.5)),
            rulePt            : Math.max(0, Na__LeCfg__Num('MarginNotes', 'RulePt', 0.35)),
            ruleColour        : Na__LeCfg__Val('MarginNotes', 'RuleColour', '#cfd4d8'),
            includeGeneral    : Na__LeCfg__Val('MarginNotes', 'IncludeGeneralNotes', true) !== false,
            groupHeadings     : Na__LeCfg__Val('MarginNotes', 'GroupHeadings', false) === true,
            gripWidthPx       : Math.max(4, Na__LeCfg__Num('MarginNotes', 'GripWidthPx', 10))
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


    // FUNCTION | Enhance Whitecard Pass Parameters
    // ------------------------------------------------------------
    function Na__LeCfg__GetEnhanceSetup() {
        return {
            levelsBlack      : Na__LeCfg__Num('Enhance', 'LevelsBlack', 0),
            levelsWhite      : Na__LeCfg__Num('Enhance', 'LevelsWhite', 205),
            levelsGamma      : Na__LeCfg__Num('Enhance', 'LevelsGamma', 1.0),
            sharpenEnabled   : Na__LeCfg__Val('Enhance', 'SharpenEnabled', true) !== false,
            sharpenRadius    : Na__LeCfg__Num('Enhance', 'SharpenRadius', 2.0),
            sharpenBlendMode : Na__LeCfg__Val('Enhance', 'SharpenBlendMode', 'Overlay'),
            sharpenOpacity   : Na__LeCfg__Num('Enhance', 'SharpenOpacity', 1.0)
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


    // FUNCTION | Model Source Setup (which design phase a viewport draws)
    // ------------------------------------------------------------
    // maxCachedPhases is how many design phases besides the one in the 3D view
    // stay loaded off-scene for drawings; beyond it the least recently drawn is
    // let go. Never under one, or a sheet of an existing and a proposed view
    // would reload a model for every other viewport it drew.
    // ------------------------------------------------------------
    function Na__LeCfg__GetModelSourceSetup() {
        return {
            maxCachedPhases : Math.max(1, Math.round(Na__LeCfg__Num('ModelSource', 'MaxCachedPhases', 3)))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Sheet Linework Widths (paper millimetres)
    // ------------------------------------------------------------
    function Na__LeCfg__GetLineworkSetup() {
        return {
            visibleWidthMm    : Na__LeCfg__Num('Linework', 'VisibleWidthMm', 0.25),
            hiddenWidthMm     : Na__LeCfg__Num('Linework', 'HiddenWidthMm', 0.18),
            hiddenDashMm      : Na__LeCfg__Num('Linework', 'HiddenDashMm', 1.2),
            authoredWidthMm   : Na__LeCfg__Num('Linework', 'AuthoredWidthMm', 0.2),
            sectionWidthMm    : Na__LeCfg__Num('Linework', 'SectionWidthMm', 0.5),
            minSegmentPaperMm : Na__LeCfg__Num('Linework', 'MinSegmentPaperMm', 0.05)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Panel Column Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetPanelSetup() {
        return {
            leftWidthPx  : Na__LeCfg__Num('Panels', 'LeftWidthPx', 250),
            rightWidthPx : Na__LeCfg__Num('Panels', 'RightWidthPx', 300),
            minWidthPx   : Na__LeCfg__Num('Panels', 'MinWidthPx', 190),
            maxWidthPx   : Na__LeCfg__Num('Panels', 'MaxWidthPx', 520),
            collapseOthers : Na__LeCfg__Val('Panels', 'CollapseOthersOnOpen', false) === true
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Navigation Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetNavigationSetup() {
        return {
            zoomMin       : Na__LeCfg__Num('Navigation', 'ZoomMin', 0.15),
            zoomMax       : Na__LeCfg__Num('Navigation', 'ZoomMax', 8),
            zoomWheelStep : Na__LeCfg__Num('Navigation', 'ZoomWheelStep', 0.0016),
            fitPaddingPx  : Na__LeCfg__Num('Navigation', 'FitPaddingPx', 32)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the PDF Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetPdfSetup() {
        return {
            filenamePattern   : Na__LeCfg__Val('Pdf', 'FilenamePattern', 'Na__{projectCode}__{sheetName}__{paperSize}.pdf'),
            author            : Na__LeCfg__Val('Pdf', 'Author', 'Noble Architecture Ltd'),
            creator           : Na__LeCfg__Val('Pdf', 'Creator', 'TrueVision3D Layout Editor'),
            jsPdfScriptPath   : Na__LeCfg__Val('Pdf', 'JsPdfScriptPath', './02__Src__AppModules/90__System__PageLayoutSystem/01__Dependencies__VersionLocked/jspdf.umd.js')
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a Label
    // ------------------------------------------------------------
    function Na__LeCfg__GetLabel(keySuffix, fallback) {
        const value = Na__LeCfg__Val('Labels', keySuffix, undefined);
        return (typeof value === 'string') ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get a Label With {tokens} Filled In
    // ------------------------------------------------------------
    function Na__LeCfg__FormatLabel(keySuffix, fallback, tokens) {
        let text = Na__LeCfg__GetLabel(keySuffix, fallback);
        Object.keys(tokens || {}).forEach((key) => { text = text.split('{' + key + '}').join(String(tokens[key])); });
        return text;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Key Map and Binding Resolution
// -----------------------------------------------------------------------------
//
// The control modules never name a button or a key. They describe what the
// user did and ask here what it means, so a binding is changed by editing
// Na__LayoutEditor__KeyMappings__.json and nothing else. A user personalisation
// screen can later write overrides in the same shape and hand them in through
// SetKeyMap without a single control module changing.
//

    // MODULE CONSTANTS | The Modifiers a Binding May Name
    // ------------------------------------------------------------
    const Na__LeCfg__MODIFIERS = [ 'Ctrl', 'Shift', 'Alt', 'Meta', 'Space' ];
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Value From a Key Map Block
    // ------------------------------------------------------------
    function Na__LeCfg__KeyVal(blockName, keyName, fallback) {
        const block = Na__LeCfg__KeyMap ? Na__LeCfg__KeyMap[Na__LeCfg__PREFIX + blockName + '__Config'] : null;
        const value = block ? block[Na__LeCfg__PREFIX + blockName + '__' + keyName] : undefined;
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Binding List, or the Built-In One
    // ------------------------------------------------------------
    function Na__LeCfg__KeyList(blockName, fallbackList) {
        const list = Na__LeCfg__KeyVal(blockName, 'List', null);
        return Array.isArray(list) ? list : fallbackList;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Whether the Held Modifiers Satisfy One Binding
    // ------------------------------------------------------------
    // Exact means the named modifiers are the only ones held, which is what
    // stops a ctrl binding from also firing the plain one. Any ignores
    // modifiers entirely, which is the Lantern Designer behaviour and the
    // shipped default for the wheel and the pan. CoarseOptional is Exact with
    // the coarse step modifier forgiven, so shift can grow a nudge without
    // needing a second binding for every arrow key.
    function Na__LeCfg__ModifiersSatisfy(binding, held) {
        const mode = binding.ModifierMatch || 'Exact';
        if (mode === 'Any') return true;
        const named   = Array.isArray(binding.Modifiers) ? binding.Modifiers : [];
        const forgive = (mode === 'CoarseOptional') ? Na__LeCfg__KeyVal('KeyboardBindings', 'CoarseStepModifier', Na__LeCfg__KEYMAP_FALLBACK.keyboardSetup.coarseStepModifier) : null;
        for (let i = 0; i < Na__LeCfg__MODIFIERS.length; i++) {
            const name = Na__LeCfg__MODIFIERS[i];
            if (name === forgive) continue;
            if (!!held[name] !== (named.indexOf(name) !== -1)) return false;
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hand a Key Map In (a saved user personalisation)
    // ------------------------------------------------------------
    function Na__LeCfg__SetKeyMap(keyMap) {
        Na__LeCfg__KeyMap = (keyMap && typeof keyMap === 'object') ? keyMap : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Guard Selectors
    // ------------------------------------------------------------
    function Na__LeCfg__GetGuards() {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.guards;
        return {
            pointerIgnoreSelector   : Na__LeCfg__KeyVal('Guards', 'PointerIgnoreSelector',   fallback.pointerIgnoreSelector),
            wheelIgnoreSelector     : Na__LeCfg__KeyVal('Guards', 'WheelIgnoreSelector',     fallback.wheelIgnoreSelector),
            contextMenuKeepSelector : Na__LeCfg__KeyVal('Guards', 'ContextMenuKeepSelector', fallback.contextMenuKeepSelector),
            paperSelector           : Na__LeCfg__KeyVal('Guards', 'PaperSelector',           fallback.paperSelector)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Keyboard Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetKeyboardSetup() {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.keyboardSetup;
        return {
            ignoreWhenTyping   : Na__LeCfg__KeyVal('KeyboardBindings', 'IgnoreWhenTyping',   fallback.ignoreWhenTyping) !== false,
            coarseStepModifier : Na__LeCfg__KeyVal('KeyboardBindings', 'CoarseStepModifier', fallback.coarseStepModifier),
            nudgeStepMm        : Na__LeCfg__KeyVal('KeyboardBindings', 'NudgeStepMm',        fallback.nudgeStepMm),
            nudgeCoarseStepMm  : Na__LeCfg__KeyVal('KeyboardBindings', 'NudgeCoarseStepMm',  fallback.nudgeCoarseStepMm),
            panStepPx          : Na__LeCfg__KeyVal('KeyboardBindings', 'PanStepPx',          fallback.panStepPx),
            panCoarseStepPx    : Na__LeCfg__KeyVal('KeyboardBindings', 'PanCoarseStepPx',    fallback.panCoarseStepPx),
            zoomKeyStep        : Na__LeCfg__KeyVal('KeyboardBindings', 'ZoomKeyStep',        fallback.zoomKeyStep)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Touch Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetTouchSetup() {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.touch;
        return {
            oneFingerPanOnStage : Na__LeCfg__KeyVal('TouchBindings', 'OneFingerPanOnStage', fallback.oneFingerPanOnStage) !== false,
            oneFingerPanOnPaper : Na__LeCfg__KeyVal('TouchBindings', 'OneFingerPanOnPaper', fallback.oneFingerPanOnPaper) === true,
            twoFingerPan        : Na__LeCfg__KeyVal('TouchBindings', 'TwoFingerPan',        fallback.twoFingerPan) !== false,
            pinchZoom           : Na__LeCfg__KeyVal('TouchBindings', 'PinchZoom',           fallback.pinchZoom) !== false,
            doubleTapFit        : Na__LeCfg__KeyVal('TouchBindings', 'DoubleTapFit',        fallback.doubleTapFit) !== false,
            doubleTapWindowMs   : Na__LeCfg__KeyVal('TouchBindings', 'DoubleTapWindowMs',   fallback.doubleTapWindowMs),
            doubleTapSlopPx     : Na__LeCfg__KeyVal('TouchBindings', 'DoubleTapSlopPx',     fallback.doubleTapSlopPx),
            panStartSlopPx      : Na__LeCfg__KeyVal('TouchBindings', 'PanStartSlopPx',      fallback.panStartSlopPx),
            pinchStartSlopPx    : Na__LeCfg__KeyVal('TouchBindings', 'PinchStartSlopPx',    fallback.pinchStartSlopPx)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Keys the Measurements Box Reads
    // ------------------------------------------------------------
    // start and typing are strings of single characters: what may begin a
    // value, and what a begun value may go on to hold. commit, clear and
    // erase are key names, and act only while something is typed.
    // ------------------------------------------------------------
    function Na__LeCfg__GetMeasureKeys() {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.measure;
        const chars = (name, fb) => { const value = Na__LeCfg__KeyVal('MeasurementsBox', name, null); return typeof value === 'string' ? value : fb; };
        const keys  = (name, fb) => { const value = Na__LeCfg__KeyVal('MeasurementsBox', name, null); return Array.isArray(value) ? value.filter((k) => typeof k === 'string') : fb.slice(); };
        return {
            start  : chars('StartCharacters', fallback.start),
            typing : chars('TypingCharacters', fallback.typing),
            commit : keys('CommitKeys', fallback.commit),
            clear  : keys('ClearKeys', fallback.clear),
            erase  : keys('EraseKeys', fallback.erase)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Mouse or Pen Press Means (null when it means nothing)
    // ------------------------------------------------------------
    // input is { button : 'Left' | 'Middle' | 'Right', modifiers : {...}, emptyStage : bool }
    function Na__LeCfg__MatchPointerBinding(input) {
        if (!input || !input.button) return null;
        const list = Na__LeCfg__KeyList('PointerBindings', Na__LeCfg__KEYMAP_FALLBACK.pointer);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false) continue;
            if (!Array.isArray(binding.Buttons) || binding.Buttons.indexOf(input.button) === -1) continue;
            if (binding.RequiresEmptyStage === true && !input.emptyStage) continue;
            if (!Na__LeCfg__ModifiersSatisfy(binding, input.modifiers || {})) continue;
            return binding.Action || null;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Wheel Turn Means (null when it means nothing)
    // ------------------------------------------------------------
    function Na__LeCfg__MatchWheelBinding(held) {
        const list = Na__LeCfg__KeyList('WheelBindings', Na__LeCfg__KEYMAP_FALLBACK.wheel);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false) continue;
            if (!Na__LeCfg__ModifiersSatisfy(binding, held || {})) continue;
            return binding.Action || null;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Key Press Means (null when it means nothing)
    // ------------------------------------------------------------
    // Returns { id, action, coarse } so a caller can size its own step from the
    // coarse modifier without having to know which modifier that is.
    function Na__LeCfg__MatchKeyBinding(key, held) {
        if (typeof key !== 'string' || !key) return null;
        const list   = Na__LeCfg__KeyList('KeyboardBindings', Na__LeCfg__KEYMAP_FALLBACK.keyboard);
        const coarse = !!(held && held[Na__LeCfg__GetKeyboardSetup().coarseStepModifier]);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false) continue;
            if (!Array.isArray(binding.Keys) || binding.Keys.indexOf(key) === -1) continue;
            if (!Na__LeCfg__ModifiersSatisfy(binding, held || {})) continue;
            return { id : binding.Id || null, action : binding.Action || null, coarse : coarse };
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Modifiers Held on a Select Press Mean
    // ------------------------------------------------------------
    // held is { Ctrl, Shift, Alt, Meta }. Returns { combine, anywhere }. combine
    // is 'add', 'toggle', 'remove', or null to replace the selection, from the
    // SelectionBindings list; the box-anywhere modifier is set aside before the
    // list is tested, so Alt+Shift still toggles. anywhere says a drag draws a
    // box even from on top of something that could be moved.
    // ------------------------------------------------------------
    function Na__LeCfg__MatchSelectionModifier(held) {
        const fallback = Na__LeCfg__KEYMAP_FALLBACK.selection;
        const name     = Na__LeCfg__KeyVal('SelectionBindings', 'BoxAnywhereModifier', fallback.boxAnywhereModifier);
        const rest     = Object.assign({}, held || {});
        const anywhere = Na__LeCfg__MODIFIERS.indexOf(name) !== -1 && !!rest[name];
        if (anywhere) rest[name] = false;
        const combines = { Select__Add : 'add', Select__Toggle : 'toggle', Select__Remove : 'remove' };
        const list     = Na__LeCfg__KeyList('SelectionBindings', fallback.list);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false || !combines[binding.Action]) continue;
            if (Na__LeCfg__ModifiersSatisfy(binding, rest)) return { combine : combines[binding.Action], anywhere : anywhere };
        }
        return { combine : null, anywhere : anywhere };
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether Any Enabled Pointer Binding Wants a Given Modifier
    // ------------------------------------------------------------
    // The PC module asks this before it takes the space bar away from the
    // browser, so space keeps scrolling the stage while no binding uses it.
    function Na__LeCfg__IsPointerModifierBound(name) {
        const list = Na__LeCfg__KeyList('PointerBindings', Na__LeCfg__KEYMAP_FALLBACK.pointer);
        for (let i = 0; i < list.length; i++) {
            const binding = list[i];
            if (!binding || binding.Enabled === false) continue;
            if ((binding.ModifierMatch || 'Exact') === 'Any') continue;
            if (Array.isArray(binding.Modifiers) && binding.Modifiers.indexOf(name) !== -1) return true;
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Bindable Action Catalogue (for a personalisation screen)
    // ------------------------------------------------------------
    function Na__LeCfg__GetActionCatalogue() {
        const list = Na__LeCfg__KeyVal('Actions', 'List', null);
        return Array.isArray(list) ? list : [];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Config State API
    // ------------------------------------------------------------
    export {
        Na__LeCfg__SetAppConfig,
        Na__LeCfg__Ready,
        Na__LeCfg__IsEnabled,
        Na__LeCfg__IsReadOnlyOnWeb,
        Na__LeCfg__GetSheetSetup,
        Na__LeCfg__GetStyleSetup,
        Na__LeCfg__GetTitleBlockSetup,
        Na__LeCfg__GetScaleSetup,
        Na__LeCfg__GetViewportSetup,
        Na__LeCfg__GetTextSetup,
        Na__LeCfg__GetDimensionSetup,
        Na__LeCfg__GetLineworkSetup,
        Na__LeCfg__GetSnappingSetup,
        Na__LeCfg__GetClipboardSetup,
        Na__LeCfg__GetModelSourceSetup,
        Na__LeCfg__GetHistorySetup,
        Na__LeCfg__GetAutoSaveSetup,
        Na__LeCfg__PtToMm,
        Na__LeCfg__GetRasterSetup,
        Na__LeCfg__GetSelectionSetup,
        Na__LeCfg__GetPlanDoorsSetup,
        Na__LeCfg__GetLineweightSetup,
        Na__LeCfg__GetShapeSetup,
        Na__LeCfg__GetMeasureSetup,
        Na__LeCfg__GetLeaderSetup,
        Na__LeCfg__GetSpecificationSetup,
        Na__LeCfg__GetMarginNotesSetup,
        Na__LeCfg__GetEyedropperSetup,
        Na__LeCfg__GetEnhanceSetup,
        Na__LeCfg__GetPanelSetup,
        Na__LeCfg__GetNavigationSetup,
        Na__LeCfg__GetPdfSetup,
        Na__LeCfg__GetLabel,
        Na__LeCfg__FormatLabel,
        Na__LeCfg__SetKeyMap,
        Na__LeCfg__GetGuards,
        Na__LeCfg__GetKeyboardSetup,
        Na__LeCfg__GetTouchSetup,
        Na__LeCfg__GetMeasureKeys,
        Na__LeCfg__MatchPointerBinding,
        Na__LeCfg__MatchWheelBinding,
        Na__LeCfg__MatchKeyBinding,
        Na__LeCfg__MatchSelectionModifier,
        Na__LeCfg__IsPointerModifierBound,
        Na__LeCfg__GetActionCatalogue
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
