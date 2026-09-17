// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CONFIG STATE - EDITOR SETUP
// =============================================================================
//
// FILE       : Na__LayoutEditor__ConfigState__EditorSetup__.js
// NAMESPACE  : Na__LeCfg
// MODULE     : Layout Editor - Config State - Editor Setup
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Answer the setup blocks for the editor around the sheet and the drawing notes
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - The editor around the sheet: undo history depth, auto save and the
//   browser draft, the panel columns and the stage navigation.
// - The drawing notes: the project specification (its file, code numbering,
//   draft, undo depth and starter groups) and a sheet's margin notes column.
//
// INTEGRATION:
// - Na__LayoutEditor__ConfigState__ re-exports every getter here, so callers
//   keep importing Na__LayoutEditor__ConfigState__.js.
// - Reads the config through Val and Num from
//   Na__LayoutEditor__ConfigState__Readers__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : GetSpecificationSetup's TrueVision file names (with
//                   legacyFileName), and TrueVision's wording in the comments
//                   above it and GetMarginNotesSetup.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__ConfigState__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config Readers
    // ------------------------------------------------------------
    import { Na__LeCfg__Val, Na__LeCfg__Num } from './Na__LayoutEditor__ConfigState__Readers__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Editor Setup Blocks
// -----------------------------------------------------------------------------

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
            defaultRevision      : String(Na__LeCfg__Val('Specification', 'DefaultRevision', 'A')),          // <-- An issued document has a revision even before one is typed
            revisionMaxLength    : Math.max(1, Math.min(12, Math.round(Na__LeCfg__Num('Specification', 'RevisionMaxLength', 6)))),
            documentNumberSuffix : String(Na__LeCfg__Val('Specification', 'DocumentNumberSuffix', '_SPEC')),
            documentName         : String(Na__LeCfg__Val('Specification', 'DocumentName', 'Project Specification')),
            downloadPaperSize    : String(Na__LeCfg__Val('Specification', 'DownloadPaperSize', 'A4')),
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
    // between notes. That gap is NoteGapMm at the least, and opens towards
    // NoteGapMaxMm when every note fits with room to spare.
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
            noteGapMaxMm      : Math.max(0, Na__LeCfg__Num('MarginNotes', 'NoteGapMaxMm', 5)),
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


    // FUNCTION | Get the Panel Column Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetPanelSetup() {
        return {
            leftWidthPx  : Na__LeCfg__Num('Panels', 'LeftWidthPx', 250),
            rightWidthPx : Na__LeCfg__Num('Panels', 'RightWidthPx', 300),
            minWidthPx   : Na__LeCfg__Num('Panels', 'MinWidthPx', 190),
            maxWidthPx   : Na__LeCfg__Num('Panels', 'MaxWidthPx', 520),
            collapseOthers : Na__LeCfg__Val('Panels', 'CollapseOthersOnOpen', false) === true,
            accordion      : (() => { const v = Na__LeCfg__Val('Panels', 'AccordionSections', null); return Array.isArray(v) ? v.slice() : [ 'text', 'dimensions', 'shapes', 'leaders' ]; })(),
            focusOnSelect  : Na__LeCfg__Val('Panels', 'FocusSectionOnSelect', true) !== false
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

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Config State Editor Setup
    // ------------------------------------------------------------
    export {
        Na__LeCfg__GetHistorySetup,
        Na__LeCfg__GetAutoSaveSetup,
        Na__LeCfg__GetSpecificationSetup,
        Na__LeCfg__GetMarginNotesSetup,
        Na__LeCfg__GetPanelSetup,
        Na__LeCfg__GetNavigationSetup
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
