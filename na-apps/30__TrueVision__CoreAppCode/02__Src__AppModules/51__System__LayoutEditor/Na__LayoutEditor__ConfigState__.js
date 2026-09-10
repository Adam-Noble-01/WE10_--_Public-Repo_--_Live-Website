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
                     { Id : 'Tool__Draw',        Action : 'Tool__Draw',        Enabled : true, Keys : [ 'l', 'L' ],               Modifiers : [], ModifierMatch : 'Exact' } ],
        keyboardSetup : { ignoreWhenTyping : true, coarseStepModifier : 'Shift', nudgeStepMm : 1, nudgeCoarseStepMm : 10,
                          panStepPx : 60, panCoarseStepPx : 240, zoomKeyStep : 1.15 },
        touch    : { oneFingerPanOnStage : true, oneFingerPanOnPaper : false, twoFingerPan : true, pinchZoom : true,
                     doubleTapFit : true, doubleTapWindowMs : 320, doubleTapSlopPx : 24, panStartSlopPx : 6, pinchStartSlopPx : 8 }
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
        return {
            denominators : Array.isArray(list) && list.length ? list.slice().sort((a, b) => a - b) : Na__LeCfg__FALLBACKS.scales.slice(),
            defaultDenominator : Na__LeCfg__Num('Scales', 'DefaultScaleDenominator', 50),
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
            assetFolder          : Na__LeCfg__Val('Viewport', 'AssetFolder', 'LayoutEditor/Snapshots')
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
            leaderStrokeMm : Na__LeCfg__Num('Text', 'LeaderStrokeMm', 0.2)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Sheet Dimension Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetDimensionSetup() {
        const terms = Na__LeCfg__Val('Dimensions', 'AllowedTerminators', null);
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
            tickLengthMm      : Na__LeCfg__Num('Dimensions', 'TickLengthMm', 1.5),
            strokeMm          : Na__LeCfg__Num('Dimensions', 'StrokeMm', 0.25),
            textGapMm         : Na__LeCfg__Num('Dimensions', 'TextGapMm', 0.8),
            defaultPrecision  : Na__LeCfg__Num('Dimensions', 'DefaultPrecision', 0),
            defaultUnits      : Na__LeCfg__Val('Dimensions', 'DefaultUnitsSuffix', ' mm'),
            thousandsSep      : Na__LeCfg__Val('Dimensions', 'ThousandsSeparator', ',')
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
            draftEnabled : Na__LeCfg__Val('AutoSave', 'DraftEnabled', true) !== false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Raster Levels for the Viewport Pictures
    // ------------------------------------------------------------
    function Na__LeCfg__GetRasterSetup() {
        const block = Na__LeCfg__Val('Raster', 'Levels', null);
        const level = (name, ppm, maxPx) => {
            const spec = (block && typeof block === 'object' && block[name] && typeof block[name] === 'object') ? block[name] : {};
            return {
                pixelsPerMm : Number.isFinite(spec.PixelsPerMm) && spec.PixelsPerMm > 0 ? spec.PixelsPerMm : ppm,
                maxPixels   : Number.isFinite(spec.MaxPixels)   && spec.MaxPixels   > 0 ? spec.MaxPixels   : maxPx
            };
        };
        return {
            defaultLevel : Na__LeCfg__Val('Raster', 'DefaultLevel', 'medium'),
            exportLevel  : Na__LeCfg__Val('Raster', 'ExportLevel', 'high'),
            scaleWithDpr : Na__LeCfg__Val('Raster', 'ScaleWithDevicePixelRatio', true) !== false,
            levels       : { low : level('low', 4, 2048), medium : level('medium', 8, 4096), high : level('high', 12, 6144) }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Points to Paper Millimetres (1 pt = 1/72 inch)
    // ------------------------------------------------------------
    function Na__LeCfg__PtToMm(pt) { return (Number.isFinite(pt) ? pt : 0) * 25.4 / 72; }
    // ------------------------------------------------------------


    // FUNCTION | Selection Setup (hit tolerance, drag threshold, grip size)
    // ------------------------------------------------------------
    function Na__LeCfg__GetSelectionSetup() {
        return {
            hitToleranceMm  : Na__LeCfg__Num('Selection', 'HitToleranceMm', 1.5),
            dragThresholdMm : Na__LeCfg__Num('Selection', 'DragThresholdMm', 0.5),
            gripSizePx      : Na__LeCfg__Num('Selection', 'GripSizePx', 9)
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
            closeRadiusPx       : Na__LeCfg__Num('Shapes', 'CloseRadiusPx', 10)
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
            markerSizePx : Na__LeCfg__Num('Snapping', 'MarkerSizePx', 10)
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
        Na__LeCfg__GetHistorySetup,
        Na__LeCfg__GetAutoSaveSetup,
        Na__LeCfg__PtToMm,
        Na__LeCfg__GetRasterSetup,
        Na__LeCfg__GetSelectionSetup,
        Na__LeCfg__GetLineweightSetup,
        Na__LeCfg__GetShapeSetup,
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
        Na__LeCfg__MatchPointerBinding,
        Na__LeCfg__MatchWheelBinding,
        Na__LeCfg__MatchKeyBinding,
        Na__LeCfg__IsPointerModifierBound,
        Na__LeCfg__GetActionCatalogue
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
