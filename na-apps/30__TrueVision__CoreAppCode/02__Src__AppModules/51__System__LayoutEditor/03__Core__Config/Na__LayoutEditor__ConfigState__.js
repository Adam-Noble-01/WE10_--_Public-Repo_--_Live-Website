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
// - This file keeps the load (SetAppConfig, Ready), the guards (IsEnabled,
//   IsReadOnlyOnWeb) and the labels (GetLabel, FormatLabel), and re-exports
//   everything else from its units in this folder:
//   - Na__LayoutEditor__ConfigState__Readers__: the parsed config, its fetch
//     and the private readers (Val, Num, Unit, Choice).
//   - Na__LayoutEditor__ConfigState__KeyMap__: the key map JSON, its fallback
//     and fetch, and every binding resolver.
//   - Na__LayoutEditor__ConfigState__SheetSetup__: paper, style, title block,
//     scales, viewports, raster, plan doors, enhance, the model source,
//     linework, lineweights and PDF.
//   - Na__LayoutEditor__ConfigState__ToolSetup__: text, dimensions, selection,
//     shapes, the Measurements box, leaders, eyedropper, clipboard, snapping.
//   - Na__LayoutEditor__ConfigState__EditorSetup__: history, auto save, the
//     project specification, margin notes, the drawing register, panels and
//     navigation.
//
// INTEGRATION:
// - The mode controller calls SetAppConfig then Ready from its Initialize,
//   which Index.html calls as the app loads; every other module in this
//   folder reads through the getters.
// - Callers keep importing this file, which still exports every name it
//   always has. The units never import this file (they share Readers), so
//   the module graph has no cycle.
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
// 18-Sep-2026 - Version 1.25.0
// - Re-exports GetViewportCacheSetup (the SheetSetup unit): the sheet surface's
//   viewport cache.
//
// 15-Sep-2026 - Version 1.24.0
// - Split into Na__LayoutEditor__ConfigState__Readers__.js,
//   Na__LayoutEditor__ConfigState__KeyMap__.js,
//   Na__LayoutEditor__ConfigState__SheetSetup__.js,
//   Na__LayoutEditor__ConfigState__ToolSetup__.js and
//   Na__LayoutEditor__ConfigState__EditorSetup__.js. No behaviour change: the
//   code moved verbatim and every export is unchanged.
// - The same split as ValeVision3D v2.47.0 (ConfigState 1.15.0). The
//   TrueVision-only GetPlanDoorsSetup, GetModelSourceSetup and PdfFontCuts
//   sit in SheetSetup.
// - INTEGRATION corrected: the mode controller calls SetAppConfig and Ready,
//   not Index.html.
//
// 14-Sep-2026 - Version 1.23.0
// - GetPdfSetup: fontFamily, fontBasePath, fontCdnBase and fonts (the three
//   Open Sans TTF cuts Download PDF embeds). GetStyleSetup's fontFamily now
//   leads with Open Sans, matching the paper.
//
// 14-Sep-2026 - Version 1.22.0
// - GetMarginNotesSetup: noteGapMaxMm, the most the gap between two notes
//   opens to when the column has room to spare (5). NoteGapMm is the least.
//
// 14-Sep-2026 - Version 1.21.0
// - GetTextSetup: rotateStepDeg (the steps Shift holds a rotate drag to, 15),
//   rotateDetentDeg (how near a right angle a free drag settles on it, 2) and
//   rotateGripOffsetPx (how far off a selected text item's outline its rotate
//   grip stands on screen, 22).
//
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
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Parsed Config, Its Fetch and the Value Reader
    // ------------------------------------------------------------
    import {
        Na__LeCfg__PREFIX,
        Na__LeCfg__Config,
        Na__LeCfg__Val,
        Na__LeCfg__Fetch
    } from './Na__LayoutEditor__ConfigState__Readers__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Key Map Fetch and Binding Resolution (re-exported below)
    // ------------------------------------------------------------
    import {
        Na__LeCfg__FetchKeyMap,
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
    } from './Na__LayoutEditor__ConfigState__KeyMap__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Setup Blocks (re-exported below)
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetSheetSetup,
        Na__LeCfg__GetStyleSetup,
        Na__LeCfg__GetTitleBlockSetup,
        Na__LeCfg__GetScaleSetup,
        Na__LeCfg__GetViewportSetup,
        Na__LeCfg__GetRasterSetup,
        Na__LeCfg__GetViewportCacheSetup,
        Na__LeCfg__PtToMm,
        Na__LeCfg__GetPlanDoorsSetup,
        Na__LeCfg__GetLineweightSetup,
        Na__LeCfg__GetEnhanceSetup,
        Na__LeCfg__GetModelSourceSetup,
        Na__LeCfg__GetLineworkSetup,
        Na__LeCfg__GetPdfSetup
    } from './Na__LayoutEditor__ConfigState__SheetSetup__.js';
    import {
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
    } from './Na__LayoutEditor__ConfigState__ToolSetup__.js';
    import {
        Na__LeCfg__GetDrawingRegisterSetup,
        Na__LeCfg__GetHistorySetup,
        Na__LeCfg__GetAutoSaveSetup,
        Na__LeCfg__GetSpecificationSetup,
        Na__LeCfg__GetMarginNotesSetup,
        Na__LeCfg__GetPanelSetup,
        Na__LeCfg__GetNavigationSetup,
        Na__LeCfg__GetWebViewerSetup
    } from './Na__LayoutEditor__ConfigState__EditorSetup__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Main App Config Block
    // ------------------------------------------------------------
    const Na__LeCfg__MAIN_BLOCK = 'LayoutEditor__Config';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Main App Config and Fetch Promise
    // ------------------------------------------------------------
    let Na__LeCfg__AppConfig   = null;
    let Na__LeCfg__LoadPromise = null;
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
// REGION | Public API - Labels
// -----------------------------------------------------------------------------

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
        Na__LeCfg__GetDrawingRegisterSetup,
        Na__LeCfg__GetHistorySetup,
        Na__LeCfg__GetAutoSaveSetup,
        Na__LeCfg__PtToMm,
        Na__LeCfg__GetRasterSetup,
        Na__LeCfg__GetViewportCacheSetup,
        Na__LeCfg__GetSelectionSetup,
        Na__LeCfg__GetEditScopeSetup,
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
        Na__LeCfg__GetWebViewerSetup,
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
