// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CONFIG STATE - EDITOR SETUP
// =============================================================================
//
// FILE       : Na__LayoutEditor__ConfigState__EditorSetup__.js
// NAMESPACE  : Na__LeCfg
// MODULE     : Layout Editor - Config State - Editor Setup
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Answer the setup blocks for the editor around the sheet, the drawing notes and the drawing register
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - The editor around the sheet: undo history depth, auto save and the
//   browser draft, the panel columns and the stage navigation.
// - The drawing notes: the project specification (its file, code numbering,
//   draft, undo depth and starter groups) and a sheet's margin notes column.
// - The drawing register: pack numbering defaults, PDF.js paths and the
//   paper palette the register PDF and preview share.
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
// 21-Sep-2026 - Version 1.3.0
// - GetNavigationSetup reads AuthoringZoomMax (64 when unset, never below
//   ZoomMax) as authoringZoomMax: how far a session that may author zooms
//   in. ZoomMax stays the ceiling for the web viewer and any read-only
//   session.
//
// 21-Sep-2026 - Version 1.2.0
// - GetNavigationSetup reads the zoom settle: zoomSettleMs (100-3000, 350 when
//   unset) and holdPaperWhileZooming (true unless the config says false), for
//   the sheet surface's "zoom now, redraw when it rests".
//
// 21-Sep-2026 - Version 1.1.1
// - GetPanelSetup's fallback fold group names Floor Areas and Patterns too, as
//   the config's AccordionSections now does, so a config that fails to load
//   folds the same sections the real one would.
//
// 19-Sep-2026 - Version 1.1.0
// - GetDrawingRegisterSetup moved out of the export region into the public
//   API region and formatted to the Layout Editor conventions.
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


    // FUNCTION | Auto Save, Browser Draft and Close Guard Setup
    // ------------------------------------------------------------
    function Na__LeCfg__GetAutoSaveSetup() {
        return {
            enabled      : Na__LeCfg__Val('AutoSave', 'Enabled', true) !== false,
            debounceMs   : Math.max(200, Na__LeCfg__Num('AutoSave', 'DebounceMs', 1500)),
            draftEnabled : Na__LeCfg__Val('AutoSave', 'DraftEnabled', true) !== false,
            draftDebounceMs : Math.max(100, Na__LeCfg__Num('AutoSave', 'DraftDebounceMs', 600)),
            closeGuardEnabled : Na__LeCfg__Val('AutoSave', 'CloseGuardEnabled', true) !== false
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


    // FUNCTION | Statement Writer Setup (the project's written documents)
    // ------------------------------------------------------------
    // Where statements live, how a new one is named, what a published picture
    // is resized to, and how the PDF is rasterised. The PDF note in the config
    // block is worth reading before changing anything under Pdf: that exporter
    // makes a picture of the page ON PURPOSE, and it is the only one that does.
    // ------------------------------------------------------------
    function Na__LeCfg__GetStatementSetup() {
        const val     = (key, fallback) => Na__LeCfg__Val('Statement', key, fallback);
        const num     = (key, fallback) => Na__LeCfg__Num('Statement', key, fallback);
        const presets = val('PdfPresets', null);

        return {
            folderName        : String(val('FolderName', '10__StatementDocs')),
            indexFileName     : String(val('IndexFileName', 'TrueVision__StatementDocs__.json')),
            imagesFolderName  : String(val('ImagesFolderName', '02_StatementDocs__Content__Images')),
            parkedFolderName  : String(val('ParkedImagesFolderName', '00__Images')),

            filePattern       : String(val('FilePattern', '{code}_T{tranche}_S{number}__{project}__{title}__.md')),
            folderPattern     : String(val('FolderPattern', '{index}__{title}')),
            defaultTranche    : String(val('DefaultTranche', '01')),
            numberDigits      : Math.max(1, Math.min(4, Math.round(num('NumberDigits', 2)))),

            draftEnabled      : val('DraftEnabled', true) !== false,
            draftDebounceMs   : Math.max(100, num('DraftDebounceMs', 700)),
            autoSaveLocalMs   : Math.max(500, num('AutoSaveLocalMs', 4000)),
            loadTimeoutMs     : Math.max(1000, num('LoadTimeoutMs', 15000)),
            confirmOverwrite  : val('ConfirmCloudOverwrite', true) !== false,

            htmlFileSuffix    : String(val('HtmlFileSuffix', '.html')),
            stylesheetUrl     : String(val('StylesheetUrl', '')),

            imageMaxEdgePx    : Math.max(320, Math.round(num('ImageMaxEdgePx', 2000))),
            imageFormat       : String(val('ImageFormat', 'image/webp')),
            imageQuality      : Math.max(0.3, Math.min(1, num('ImageQuality', 0.82))),
            imagePassThrough  : Math.max(0, Math.round(num('ImagePassThroughBytes', 350000))),

            pdfMaxPagePt      : Math.max(1000, num('PdfMaxPagePt', 14399)),
            pdfTileCssPx      : Math.max(500, Math.round(num('PdfTileCssPx', 4000))),
            pdfPresets        : Array.isArray(presets) && presets.length ? presets : [
                { Key : 'full',    Label : 'Download PDF',         RasterScale : 2.00, JpegQuality : 0.92, FileSuffix : ''          },
                { Key : 'compact', Label : 'Download PDF (small)', RasterScale : 1.25, JpegQuality : 0.75, FileSuffix : '__Compact' }
            ],
            html2CanvasPath   : String(val('Html2CanvasScriptPath',
                './02__Src__AppModules/90__System__PageLayoutSystem/01__Dependencies__VersionLocked/html2canvas.umd.js'))
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
            accordion      : (() => { const v = Na__LeCfg__Val('Panels', 'AccordionSections', null); return Array.isArray(v) ? v.slice() : [ 'text', 'dimensions', 'shapes', 'leaders', 'floor-areas', 'patterns' ]; })(),
            focusOnSelect  : Na__LeCfg__Val('Panels', 'FocusSectionOnSelect', true) !== false
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Web Viewer Setup
    // ------------------------------------------------------------
    // The read-only document viewer the live web build shows instead of the
    // editor. Enabled is the switch that turns the whole thing off and hands
    // the web build back the read-only editor it had before, so a regression
    // here is one JSON key away from being undone on a live site.
    // ------------------------------------------------------------
    function Na__LeCfg__GetWebViewerSetup() {
        return {
            enabled             : Na__LeCfg__Val('WebViewer', 'Enabled', true) !== false,
            showSpecification   : Na__LeCfg__Val('WebViewer', 'ShowSpecification', true) !== false,
            swipeEnabled        : Na__LeCfg__Val('WebViewer', 'SwipeToChangeDocument', true) !== false,
            swipeMinPx          : Math.max(20, Na__LeCfg__Num('WebViewer', 'SwipeMinPx', 70)),
            doubleTapZoomFactor : Math.max(1.1, Na__LeCfg__Num('WebViewer', 'DoubleTapZoomFactor', 2.5))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Navigation Setup
    // ------------------------------------------------------------
    // Two ceilings on the zoom. zoomMax is a reader's: the web document
    // viewer's, and any session's that may not author. authoringZoomMax is how
    // close a session that may author gets (localhost, or a device unlocked
    // for authoring), and is never less than a reader's. The navigation module
    // picks between them through the authoring gate.
    // ------------------------------------------------------------
    function Na__LeCfg__GetNavigationSetup() {
        const zoomMax = Na__LeCfg__Num('Navigation', 'ZoomMax', 8);
        return {
            zoomMin       : Na__LeCfg__Num('Navigation', 'ZoomMin', 0.15),
            zoomMax       : zoomMax,
            authoringZoomMax : Math.max(zoomMax, Na__LeCfg__Num('Navigation', 'AuthoringZoomMax', 64)),   // <-- An author works closer in than a reader ever needs to
            zoomWheelStep : Na__LeCfg__Num('Navigation', 'ZoomWheelStep', 0.0016),
            fitPaddingPx  : Na__LeCfg__Num('Navigation', 'FitPaddingPx', 32),
            zoomSettleMs  : Math.min(3000, Math.max(100, Na__LeCfg__Num('Navigation', 'ZoomSettleMs', 350))),   // <-- How long a zoom must rest before what follows it runs (LayOut's range)
            holdPaperWhileZooming : Na__LeCfg__Val('Navigation', 'HoldPaperWhileZooming', true) !== false       // <-- The paper held as one layer until the zoom settles
        };
    }
    // ------------------------------------------------------------


    // CONSTANTS | Register Table Columns When the Config Block Is Silent
    // ------------------------------------------------------------
    const Na__LeCfg__REGISTER_COLUMNS = [                                          // <-- Exactly one column carries Flex; the rest are measured from their content
        { key : 'drawingNo',    heading : 'DWG No.',       align : 'left',   flex : false, minMm : 15 },
        { key : 'phase',        heading : 'PHASE',         align : 'centre', flex : false, minMm : 15 },
        { key : 'documentCode', heading : 'DOCUMENT CODE', align : 'left',   flex : false, minMm : 28 },
        { key : 'name',         heading : 'DOCUMENT NAME', align : 'left',   flex : true,  minMm : 34 },
        { key : 'scale',        heading : 'SCALE',         align : 'left',   flex : false, minMm : 17 },
        { key : 'size',         heading : 'SIZE',          align : 'centre', flex : false, minMm : 14 },
        { key : 'revision',     heading : 'REV',           align : 'centre', flex : false, minMm : 12 }
    ];
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Configured Register Columns, Falling Back to the Constant
    // ------------------------------------------------------------
    function Na__LeCfg__RegisterColumns(configured) {
        if (!Array.isArray(configured) || configured.length === 0) return Na__LeCfg__REGISTER_COLUMNS;
        const columns = configured
            .filter((column) => column && column.Key)
            .map((column) => ({
                key     : String(column.Key),
                heading : String(column.Heading === undefined ? column.Key : column.Heading),
                align   : column.Align === 'centre' || column.Align === 'center' ? 'centre' : (column.Align === 'right' ? 'right' : 'left'),
                flex    : column.Flex === true,
                minMm   : Number.isFinite(Number(column.MinMm)) ? Number(column.MinMm) : 14
            }));
        if (columns.length === 0) return Na__LeCfg__REGISTER_COLUMNS;
        if (!columns.some((column) => column.flex)) columns[0].flex = true;         // <-- A table with no flex column could not fill the page width
        return columns;
    }
    // ------------------------------------------------------------


    // CONSTANTS | Job Stages When the Config Block Is Silent
    // ------------------------------------------------------------
    const Na__LeCfg__REGISTER_PHASES = [                                           // <-- T01 Concept through T04 Site: the middle third of a document code
        { code : 'T01', name : 'Concept' },
        { code : 'T02', name : 'Planning' },
        { code : 'T03', name : 'Building Regs' },
        { code : 'T04', name : 'Site & Remedial' }
    ];
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Configured Phases, Falling Back to the Constant
    // ------------------------------------------------------------
    function Na__LeCfg__RegisterPhases(configured) {
        if (!Array.isArray(configured) || configured.length === 0) return Na__LeCfg__REGISTER_PHASES;
        const phases = configured
            .filter((phase) => phase && phase.Code)
            .map((phase) => ({
                code : String(phase.Code).trim(),
                name : String(phase.Name === undefined ? phase.Code : phase.Name).trim()
            }))
            .filter((phase) => phase.code);
        return phases.length ? phases : Na__LeCfg__REGISTER_PHASES;
    }
    // ------------------------------------------------------------


    // FUNCTION | Drawing Register Defaults and Noble Architecture Paper Palette
    // ------------------------------------------------------------
    function Na__LeCfg__GetDrawingRegisterSetup() {
        const val = (key, fallback) => Na__LeCfg__Val('DrawingRegister', key, fallback);
        const num = (key, fallback) => {
            const read = Number(val(key, fallback));
            return Number.isFinite(read) ? read : fallback;
        };
        return {
            prefix          : val('Prefix', 'D'),
            start           : val('Start', 1),
            digits          : val('Digits', 2),
            pdfMarginMm     : num('PdfMarginMm', 14),
            pdfFontPt       : num('PdfFontPt', 9),
            pdfJsScriptPath : val('PdfJsScriptPath', '/na-apps/20__PlanVision__CoreAppCode/01__AppDependencies__VersionLocked/PdfJs__3.11.174/build/pdf.min.js'),
            pdfJsWorkerPath : val('PdfJsWorkerPath', '/na-apps/20__PlanVision__CoreAppCode/01__AppDependencies__VersionLocked/PdfJs__3.11.174/build/pdf.worker.min.js'),

            titlePt         : num('TitlePt', 19),                                  // <-- Document typography, all sized against pdfFontPt
            headingPt       : num('HeadingPt', 11),
            metaPt          : num('MetaPt', 8.5),
            tableHeadPt     : num('TableHeadPt', 7.5),
            notePt          : num('NotePt', 9),

            rowPadMm        : num('RowPadMm', 4),                                  // <-- Table rhythm; a one-line row is rowPadMm * 2 + lineMm tall
            lineMm          : num('LineMm', 4.6),
            cellPadMm       : num('CellPadMm', 3.2),
            headRowMm       : num('HeadRowMm', 9.5),
            columnMaxMm     : num('ColumnMaxMm', 46),
            columns         : Na__LeCfg__RegisterColumns(val('Columns', null)),

            phases          : Na__LeCfg__RegisterPhases(val('Phases', null)),      // <-- The stages of a job, and the middle third of every document code
            defaultPhase    : String(val('DefaultPhase', 'T01')),
            documentCodeFmt : String(val('DocumentCodeFormat', '{project}_{phase}_{drawing}')),
            registerSuffix  : String(val('RegisterNumberSuffix', '_REGISTER')),   // <-- PS01_REGISTER, beside the specification's PS01_SPEC
            logoAspect      : num('LetterheadLogoAspect', 4.096),                 // <-- The asset is 2048 x 500; see TitleBlock LogoAspectWidthOverHeightNote

            collapseScale   : val('CollapseScaleSuffix', true) !== false,          // <-- '1:50 @ ISO A2' prints as '1:50' when SIZE already says ISO A2
            emptyCell       : String(val('EmptyCellText', '—')),             // <-- What an empty table cell prints instead of nothing at all

            previewWidthPx  : num('PreviewPageWidthPx', 794),                      // <-- The Read view's CSS page width, and the ceiling its canvas is drawn to
            previewMaxDpr   : num('PreviewMaxPixelRatio', 3),

            ink             : val('InkColour', '#172b3a'),
            muted           : val('MutedColour', '#6c757d'),
            accent          : val('AccentColour', '#172b3a'),
            header          : val('HeaderColour', '#eef1f4'),
            stripe          : val('StripeColour', '#f6f8fa'),
            rule            : val('RuleColour', '#d9dfe4'),
            warnAmberFill   : val('WarnAmberFill', '#fff6e3'),
            warnAmberInk    : val('WarnAmberInk', '#8a5a00'),
            warnRedFill     : val('WarnRedFill', '#fdf0f0'),
            warnRedInk      : val('WarnRedInk', '#9b3b3b')
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
        Na__LeCfg__GetDrawingRegisterSetup,
        Na__LeCfg__GetHistorySetup,
        Na__LeCfg__GetAutoSaveSetup,
        Na__LeCfg__GetSpecificationSetup,
        Na__LeCfg__GetStatementSetup,
        Na__LeCfg__GetMarginNotesSetup,
        Na__LeCfg__GetPanelSetup,
        Na__LeCfg__GetNavigationSetup,
        Na__LeCfg__GetWebViewerSetup
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
