// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - MODE CONTROLLER
// =============================================================================
//
// FILE       : Na__LayoutEditor__ModeController__.js
// NAMESPACE  : Na__LeMode
// MODULE     : Layout Editor - Mode Controller
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Enter and leave the sheet editor, own its shell, and keep the paper in step with the model
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Entering: any drawing mode is exited first, the 3D overlays (carousel,
//   nav toolbar, help, export frame) and both dropdown menus (Tools &
//   Settings and the localhost Dev Tools container) go behind a body class,
//   the WebGL canvas stays alive but invisible so snapshots still render,
//   and the host fills the space under the header and tab strip with the
//   panels, toolbar and stage (D22 to D24). Leaving puts it all back.
// - The menus are 3D Model tab furniture: they are also collapsed on entry
//   so the 3D view is never handed back with a menu hanging open.
// - The shell is built once, on the first entry, after the config and the
//   model are ready. Editing is allowed on localhost, or anywhere when
//   Main.json turns the web read-only flag off.
// - A SESSION THAT CANNOT AUTHOR GETS A DIFFERENT SHELL, NOT A DISABLED ONE.
//   No panel columns, no toolbar row and no sheet tools: the read-only web
//   build is the document viewer in 80__Feature__WebViewer, which owns the
//   document bar, the dock and which of its two reading surfaces is showing.
//   Not building the authoring surface is what keeps it off a reader's paper.
// - Sheet model changes are routed to the surface by reason so a pan does
//   not rebuild the chrome and a rename does not re-render a viewport.
// - Answers the panels' Edit In Drawing request by leaving and opening the
//   plan or elevation in its own edit mode (D34).
//
// INTEGRATION:
// - Initialized from index.html with the render context; the tab strip and
//   Dev menu call Enter and Leave.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__ModeController__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.29.0
// - Overspill note regions' grips (Na__LayoutEditor__NoteRegions__Grips__) are
//   attached and detached with the sheet input, beside the margin grip, and
//   never for a viewer. A region is part of the notes margin record, so its
//   changes are 'margin' changes: the markup redraws and the Margin Notes
//   panel refreshes by the route the margin already had.
//
// 21-Sep-2026 - Version 1.28.0
// - The Drawing Axes Overlay (Na__LayoutEditor__DrawingAxes__, F9) is
//   attached and detached with the sheet input, straight after the drawing
//   grid, so it follows the pointer on a drawing tab and never for a viewer.
//
// 21-Sep-2026 - Version 1.27.0
// - Registers the Vector Tools panel (37__System__VectorTools) in the right
//   column straight after Vectors, where Adam marked it, and runs
//   Na__LeVec__Initialize once beside the history's: what is drawn inside a
//   group open for editing joins that group.
//
// 21-Sep-2026 - Version 1.26.0
// - SHEET IMAGES (54__Feature__SheetImages). Na__LeImg__Ready joins the
//   first-open wait and Na__LeImg__Initialize runs after the model: the
//   picture source for everyone, and in the editor the save step that files
//   pictures under their drawing's document id, the corner grips and the
//   file drop. AttachSheetInput / DetachSheetInput take the drop with the
//   rest of the sheet's input (leaving a sheet keeps a crop in progress).
//   The Images panel registers after Vectors, SectionForKind opens it for a
//   selection of pictures, and a shape change refreshes it.
//
// 21-Sep-2026 - Version 1.25.0
// - THE DRAWING TABS' KEYBOARD IS STARTED AFRESH EVERY TIME A DRAWING IS
//   OPENED FROM ANOTHER TAB (RestartSheetKeys), as Adam asked: from the 3D
//   Model tab, the Project Specification, the Drawing Register or the
//   Statements. Every listener comes off and goes back on - a key held, a
//   value half typed and a tool half used go with them, and Select is up -
//   the drawing tabs' key file is read again (Na__LeCfg__ReloadKeyMap: the
//   map in force stays until it lands, and a failed read keeps it), and the
//   stage is given the keyboard (Na__LePc__TakeKeyboard), so a field left with
//   the focus on the tab just closed cannot keep the sheet's keys. One
//   drawing to another keeps its keyboard as it is.
//
// 21-Sep-2026 - Version 1.24.0
// - The drawing grid (Na__LayoutEditor__DrawingGrid__, SketchUp LayOut's
//   grid): the Drawing Grid section registers straight after Sheet on the
//   Document Preferences tab, and the grid is attached and detached with the
//   sheet tools, so it is drawn on a drawing tab and never for a viewer.
//
// 21-Sep-2026 - Version 1.23.0
// - PAGE UP AND PAGE DOWN TURN THE DRAWINGS. StepSheet answers the PC
//   controls' STEP_SHEET_EVENT by entering the drawing before or after this
//   one, in tab order, exactly as clicking that tab does. Drawings only; the
//   ends stop.
// - WALK AND FLY ARE LEFT WHEN THE EDITOR OPENS. Enter asks SuspendThreeD for
//   the whole exit (returnToOrbit), where the old "conversion" only relit the
//   toolbar: opening a drawing tab while walking left Walk running through the
//   editor and after it, under a toolbar that read Orbit.
// - Ctrl+S's comment: the Drawing Register now answers the key itself.
//
// 21-Sep-2026 - Version 1.22.0
// - THREE TOOL SETS, THREE KEYBOARDS. The app's key scope
//   (Na__AppUtils__KeyScope__) follows this module: KeyScope reads which
//   keyboard belongs to what is on screen - the 3D Model tab's keys with the
//   editor closed, the drawing tools' on a drawing tab, the documents' own on
//   the Project Specification, the Drawing Register and the Statements - and
//   it is handed over once, at initialisation, and asked on every key, so no
//   path in or out can leave a stale answer behind. The 3D hotkeys had been
//   answering under every tab - R typed into a statement reset a hidden
//   camera and never reached the page - and now keep to their own.
// - The documents' keyboard (31__System__DocumentKeys) is waited on with the
//   other configs and started here. It hears a key before anything else in
//   the app, so on the Statements tab Ctrl+S saves the statement - it was
//   saving the sheets - and on the other two tabs it still reaches the save
//   below.
//
// 21-Sep-2026 - Version 1.21.0
// - FLOOR AREAS AND PATTERNS FOLD WITH THE REST. Selecting a viewport used to
//   leave the fold group as it was (v2.57.0, "deliberate for now"), so Floor
//   Areas and Patterns stood open over a selected drawing. A viewport now
//   folds the whole group, and a single site plan viewport opens Patterns,
//   whose hatch rows are the one part of the group that edits a drawing.
//   Patterns joins LayoutEditor__Panels__AccordionSections, which Floor Areas
//   joined in v2.104.0 along with SectionForKind's floor-area rule: a
//   selection of rooms opens Floor Areas, not Vectors.
// - v2.104.0 also wired Floor Areas in here: its config is read before the
//   editor opens, its schedules follow their rooms (Na__LeAreaTable__Attach),
//   its panel is registered after Patterns, and 'areas' refreshes the markup.
//
// 20-Sep-2026 - Version 1.20.0
// - The left column has two tabs, Document Preferences and Specification, as
//   the right column has Properties and Scrapbook. Every section the column
//   held is on Document Preferences, which is registered first so it is theirs
//   by default. Specification holds the Specification Scrapbook
//   (58__Feature__ScrapbookSpecification): the project's notes, each code in a
//   bubble that is dragged onto the paper. All four tabs carry hover text.
//
// 20-Sep-2026 - Version 1.19.0
// - Starts Na__LayoutEditor__ViewportIdentity__ with the editor: it names
//   unnamed elevation viewports from the model they draw and the project's
//   north, through the sheet model's RegisterViewportNamer.
//
// 19-Sep-2026 - Version 1.18.0
// - The right column has two tabs, Properties and Scrapbook. The three
//   scrapbook libraries leave the left column for the Scrapbook tab, which
//   Adam asked for; every section that was in the right column is on
//   Properties, which is registered first so it is theirs by default.
//
// 19-Sep-2026 - Version 1.17.0
// - The Custom and the Parametric Scrapbooks (56__Feature__ScrapbookCustom,
//   57__Feature__ScrapbookParametric) register their sections: both libraries in
//   the left column after the Scrapbook, and the selected parametric element's
//   settings at the top of the right column.
//
// 18-Sep-2026 - Version 1.16.0
// - The web viewer. A session that cannot author gets a different shell, not a
//   disabled one: no panel columns, no toolbar row, and AttachSheetInput binds
//   nothing, so the editing tools are never attached rather than attached and
//   told to behave. Entering a sheet and opening the specification route
//   through Na__LayoutEditor__WebViewer__, which owns the document bar, the
//   dock and which reading surface is on. Leaving stands both surfaces down.
//
// 17-Sep-2026 - Version 1.15.0
// - SectionForKind and FocusPanelForSelection: a selection change, and the
//   eyedropper picking up a style, open that kind's panel and fold the rest of
//   the markup group. One kind, one panel; a mixed selection opens nothing.
//
// 14-Sep-2026 - Version 1.14.0
// - Registers the Scrapbook (Na__LayoutEditor__Panel__Scrapbook__) in the left
//   column after Sheet. It shows only on a sheet that has items - today, site
//   plan sheets.
//
// 14-Sep-2026 - Version 1.13.0
// - Waits on the dashed-edge config (Na__LayoutEditor__LineStyleTool__) with
//   the other editor configs, so the first sheet a project opens is
//   normalised against the real millimetre figures rather than the fallbacks.
//
// 14-Sep-2026 - Version 1.12.0
// - A group change ('group', 'groups') redraws the markup so the blue box
//   and the members stay in step.
//
// 14-Sep-2026 - Version 1.11.0
// - The Measurements box (Na__LayoutEditor__Measurements__) is mounted in the
//   stage's column when the shell is built; the sheet tools attach it.
//
// 14-Sep-2026 - Version 1.10.0
// - Project Specification: the tab's page lies over the editor host. Opening
//   it stands the sheet's pointer, keys and margin grip down; a sheet tab
//   brings them back without re-fitting the paper when it is the same sheet.
//   GetView says which is showing; OpenSpecification answers the tab, and the
//   specification's open and go-to requests (a panel's button, a usage chip).
// - The specification is read on the first entry into the editor and never
//   before. Its links and draft listen from initialisation. A change to it
//   redraws the markup (bubble codes, notes margins) and the Leaders and
//   Margin Notes panels, once the sheet is showing again.
// - The Margin Notes panel is registered after Sheet; a 'margin' change redraws
//   the markup and refreshes that panel, and a leader change refreshes it too.
// - The PDF library is loaded on the first entry, so the notes margin and the
//   title block measure text with the metrics the PDF prints with.
//
// 14-Sep-2026 - Version 1.9.0
// - The Leaders panel is registered in the right column, after Text. A leader
//   change ('leader', 'leaders') redraws the markup and refreshes only the
//   Leaders panel, as a text, dimension or vector change does its own.
//
// 13-Sep-2026 - Version 1.8.0 (TrueVision)
// - Model Source: the design phase library's changes refresh the frames (and the
//   panels, bar the per-file progress), and the configured cache of off-scene
//   phases is handed to the library once the config is in.
//
// 13-Sep-2026 - Version 1.7.0
// - A palette sync (the settings for new objects changed from outside their
//   panel) refreshes the panel for that kind.
//
// 13-Sep-2026 - Version 1.6.1
// - The gradient tool's config (Na__LayoutEditor__GradientTool__Config__.json)
//   is waited on with the others, so the first shape defaults read the real file.
//
// 13-Sep-2026 - Version 1.6.0
// - Shapes were never routed to a redraw. 'shape' and 'shapes' now refresh the
//   markup exactly as text and dimensions do. A deleted or restyled vector used
//   to stay on the paper unchanged until some unrelated edit repainted the sheet,
//   which read as a slow editor rather than as a missing route.
// - A text, dimension or vector change refreshes only its own panel; viewport
//   and structural changes still refresh every section.
//
// 10-Sep-2026 - Version 1.5.0
// - A raster level change refreshes the frames.
//
// 10-Sep-2026 - Version 1.4.0
// - Vectors panel registered.
//
// 10-Sep-2026 - Version 1.3.0
// - The history module listens from initialisation; entering a sheet takes its undo baseline.
// - Auto save and the browser draft are initialised with it.
//
// 10-Sep-2026 - Version 1.2.0
// - The render loop is paused and 3D navigation suspended for the whole time a
//   sheet is open; both come back on leaving. Projection events only refresh the
//   frames once a render is finished; fingerprints are reset per session.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// 10-Sep-2026 - Version 1.1.0
// - Tools & Settings and Dev Tools menus hidden while a drawing tab is open,
//   and collapsed on entry, so they are only ever used on the 3D Model tab.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Navigation, Tools, Panels, Toolbar, Snapshots
    // ------------------------------------------------------------
    import { Na__LeCfg__SetAppConfig, Na__LeCfg__Ready, Na__LeCfg__IsEnabled, Na__LeCfg__IsReadOnlyOnWeb, Na__LeCfg__GetLabel, Na__LeCfg__GetPanelSetup, Na__LeCfg__MatchKeyBinding, Na__LeCfg__ReloadKeyMap } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeVeil__FirstOpen, Na__LeVeil__ReturnTo3d, Na__LeVeil__Dismiss3d } from './Na__LayoutEditor__LoadingVeil__.js';
    import { Na__LeEdge__Ready } from '../25__System__RenderStyles/Na__LayoutEditor__EdgeStyles__.js';
    import { Na__LePanelPatterns__Register } from '../36__System__HatchPatternTools/Na__LayoutEditor__Panel__Patterns__.js';
    import { Na__LePanelArea__Register } from '../59__Feature__FloorAreas/Na__LayoutEditor__Panel__FloorAreas__.js';
    import { Na__LeArea__Ready, Na__LeArea__Is } from '../59__Feature__FloorAreas/Na__LayoutEditor__FloorAreas__.js';
    import { Na__LeAreaTable__Attach } from '../59__Feature__FloorAreas/Na__LayoutEditor__FloorAreas__Table__.js';
    import { Na__LeImg__Ready, Na__LeImg__Initialize, Na__LeImg__Is, Na__LeImg__AttachInput, Na__LeImg__DetachInput } from '../54__Feature__SheetImages/Na__LayoutEditor__SheetImages__.js';
    // @delegate: ../59__Feature__FloorAreas/
    import { Na__LeHatch__Ready } from '../36__System__HatchPatternTools/Na__LayoutEditor__HatchPatterns__.js';
    import { Na__LeComposite__Ready } from '../25__System__RenderStyles/Na__LayoutEditor__RenderComposites__.js';
    import { Na__DrawCfg__Load } from '../../40__System__DrawingViewCore/Na__DrawView__ConfigState__.js';
    import { Na__LeGrad__Ready } from '../35__System__DrawingTools/Na__LayoutEditor__GradientTool__.js';
    import { Na__LeDash__Ready } from '../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js';
    // @delegate: ../35__System__DrawingTools/Na__LayoutEditor__LineStyleTool__.js
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__Initialize,
        Na__LeModel__GetSheets,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__SetActiveSheetId,
        Na__LeModel__SetSelection,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__GetShapeById,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsSitePlanViewport,
        Na__LeModel__GetViewports
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__Mount, Na__LeSurface__SetSheet, Na__LeSurface__Refresh, Na__LeSurface__SetZoom, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeNav__Fit } from '../10__Core__SheetSurface/Na__LayoutEditor__Navigation__.js';
    import { Na__LePc__STEP_SHEET_EVENT, Na__LePc__Attach, Na__LePc__Detach, Na__LePc__TakeKeyboard } from '../10__Core__SheetSurface/Na__LayoutEditor__Controls__Pc__.js';
    import { Na__LeTouch__Attach, Na__LeTouch__Detach } from '../10__Core__SheetSurface/Na__LayoutEditor__Controls__TouchScreen__.js';
    import { Na__LeTools__DEFAULTS_EVENT, Na__LeTools__Attach, Na__LeTools__Detach } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LePanels__Mount, Na__LePanels__Refresh, Na__LePanels__FocusSection, Na__LePanels__RegisterTab } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import { Na__LeGroup__Expand } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeDrop__CHANGED_EVENT } from '../30__System__SheetTools/Na__LayoutEditor__Eyedropper__.js';
    import { Na__LePanelLayers__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Layers__.js';
    import { Na__LePanelSheet__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Sheet__.js';
    import { Na__LePanelGrid__Register } from '../27__System__DrawingGrid/Na__LayoutEditor__Panel__DrawingGrid__.js';
    import { Na__LeGrid__Attach, Na__LeGrid__Detach } from '../27__System__DrawingGrid/Na__LayoutEditor__DrawingGrid__.js';
    import { Na__LeAxes__Attach, Na__LeAxes__Detach } from '../33__System__DrawingAxes/Na__LayoutEditor__DrawingAxes__.js';
    import { Na__LePanelScrap__Register, Na__LePanelScrap__RegisterTab } from '../55__Feature__Scrapbook/Na__LayoutEditor__Panel__Scrapbook__.js';
    import { Na__LePanelScrapCustom__Register } from '../56__Feature__ScrapbookCustom/Na__LayoutEditor__Panel__ScrapbookCustom__.js';
    import { Na__LePanelParam__RegisterLibrary, Na__LePanelParam__RegisterProperties } from '../57__Feature__ScrapbookParametric/Na__LayoutEditor__Panel__ScrapbookParametric__.js';
    import { Na__LePanelScrapSpec__RegisterTab, Na__LePanelScrapSpec__Register } from '../58__Feature__ScrapbookSpecification/Na__LayoutEditor__Panel__ScrapbookSpecification__.js';
    import { Na__LePanelViewport__EDIT_EVENT, Na__LePanelViewport__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__ViewportSettings__.js';
    import { Na__LePanelText__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Text__.js';
    import { Na__LePanelLeaders__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Leaders__.js';
    import { Na__LePanelDims__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Dimensions__.js';
    import { Na__LePanelShapes__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Shapes__.js';
    import { Na__LePanelVec__Register } from '../37__System__VectorTools/Na__LayoutEditor__Panel__VectorTools__.js';
    import { Na__LeVec__Initialize } from '../37__System__VectorTools/Na__LayoutEditor__VectorTools__.js';
    import { Na__LePanelImages__Register } from '../54__Feature__SheetImages/Na__LayoutEditor__Panel__SheetImages__.js';
    import { Na__LePanelStyles__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Styles__.js';
    import { Na__LePanelSpComp__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__SitePlanComposites__.js';
    import { Na__LeSpComp__Ready } from '../25__System__RenderStyles/Na__LayoutEditor__SitePlanComposites__.js';
    import { Na__LePanelModelLayers__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__ModelLayers__.js';
    import { Na__LeToolbar__Mount, Na__LeToolbar__Save } from '../40__Ui__Panels/Na__LayoutEditor__Toolbar__.js';
    import { Na__LeMeasure__Mount } from '../30__System__SheetTools/Na__LayoutEditor__Measurements__.js';
    import { Na__LeSnap__Initialize, Na__LeSnap__ResetFingerprints } from '../25__System__RenderStyles/Na__LayoutEditor__SnapshotRenderer__.js';
    import { Na__LeOsnap__Clear } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';
    import { Na__LeHist__Initialize, Na__LeHist__Track } from '../07__Core__SheetData/Na__LayoutEditor__History__.js';
    import { Na__LeAuto__Initialize } from '../07__Core__SheetData/Na__LayoutEditor__AutoSave__.js';
    import { Na__LeRaster__CHANGED_EVENT } from '../20__System__Viewports/Na__LayoutEditor__RasterQuality__.js';
    import { Na__LePanelMargin__Register } from '../50__Feature__Specification/Na__LayoutEditor__Panel__MarginNotes__.js';
    import { Na__LeSpec__CHANGED_EVENT, Na__LeSpec__OPEN_EVENT, Na__LeSpec__GOTO_EVENT, Na__LeSpec__Initialize, Na__LeSpec__EnsureLoaded } from '../50__Feature__Specification/Na__LayoutEditor__SpecData__.js';
    import { Na__LeSpecLink__Initialize } from '../50__Feature__Specification/Na__LayoutEditor__SpecLinks__.js';
    // @delegate: ../51__Feature__DrawingRegister/Na__LayoutEditor__Register__Editor__.js
    import { Na__LeRegEd__Mount, Na__LeRegEd__Show, Na__LeRegEd__Hide } from '../51__Feature__DrawingRegister/Na__LayoutEditor__Register__Editor__.js';
    import { Na__LeReg__Initialize } from '../51__Feature__DrawingRegister/Na__LayoutEditor__Register__Data__.js';
    import { Na__LeRegEdit__Initialize } from '../51__Feature__DrawingRegister/Na__LayoutEditor__Register__Transactions__.js';
    // @delegate: ../52__Feature__StatementWriter/03__Ui__Page/Na__LayoutEditor__Statement__Page__.js
    import { Na__LeStmtPage__Mount, Na__LeStmtPage__Show, Na__LeStmtPage__Hide } from '../52__Feature__StatementWriter/03__Ui__Page/Na__LayoutEditor__Statement__Page__.js';
    import { Na__LeStmt__OPEN_EVENT, Na__LeStmt__Initialize } from '../52__Feature__StatementWriter/01__Core__Data/Na__LayoutEditor__Statement__Data__.js';
    import { Na__LeSpecEd__Mount, Na__LeSpecEd__Show, Na__LeSpecEd__Hide } from '../50__Feature__Specification/Na__LayoutEditor__SpecEditor__.js';
    import { Na__LeMarginGrip__Attach, Na__LeMarginGrip__Detach } from '../50__Feature__Specification/Na__LayoutEditor__MarginGrip__.js';
    import { Na__LeRegionGrip__Attach, Na__LeRegionGrip__Detach } from '../50__Feature__Specification/Na__LayoutEditor__NoteRegions__Grips__.js';
    import { Na__LeText__Commit } from '../35__System__DrawingTools/Na__LayoutEditor__TextTool__.js';
    import { Na__LePdf__EnsureJsPdf } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfExporter__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Modes, Render Loop, Projection Events, Localhost
    // ------------------------------------------------------------
    import { Na__FloorPlanMode__IsEngaged, Na__FloorPlanMode__ExitPlan, Na__FloorPlanMode__EnterPlan, Na__FloorPlanMode__SetEditMode } from '../../42__System__FloorPlanViews/Na__FloorPlan__ModeController__.js';
    import { Na__ElevationMode__IsEngaged, Na__ElevationMode__ExitElevation, Na__ElevationMode__EnterElevation, Na__ElevationMode__SetEditMode } from '../../45__System__ElevationViews/Na__Elevation__ModeController__.js';
    import { Na__RenderLoop__RequestRender, Na__RenderLoop__Pause, Na__RenderLoop__Resume } from '../../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import { Na__DrawView__Transitions__SuspendThreeD, Na__DrawView__Transitions__ResumeThreeD } from '../../40__System__DrawingViewCore/Na__DrawView__Transitions__.js';
    import { Na__PlPipe__CHANGED_EVENT, Na__PlPipe__STATUS_READY } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__Pipeline__.js';
    import { Na__PhaseLib__CHANGED_EVENT } from '../../26__System__ToggleModelElements/Na__ModelGroup__PhaseLibrary__.js';
    import { Na__LeSource__Initialize } from '../20__System__Viewports/Na__LayoutEditor__ModelSource__.js';
    import { Na__LeViewId__Initialize } from '../20__System__Viewports/Na__LayoutEditor__ViewportIdentity__.js';
    import { Na__DevGate__IsAuthoringEnabled } from '../../03__AppUtils/Na__AppUtils__DevGate__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Which Keyboard Is Live, and the Documents' Own
    // ------------------------------------------------------------
    // @delegate: ../../03__AppUtils/Na__AppUtils__KeyScope__.js
    // @delegate: ../31__System__DocumentKeys/Na__LayoutEditor__DocumentKeys__.js
    // ------------------------------------------------------------
    import { Na__KeyScope__MODEL, Na__KeyScope__SHEET, Na__KeyScope__DOCUMENT, Na__KeyScope__Follow } from '../../03__AppUtils/Na__AppUtils__KeyScope__.js';
    import { Na__LeDocKeys__Ready, Na__LeDocKeys__Initialize } from '../31__System__DocumentKeys/Na__LayoutEditor__DocumentKeys__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Web Viewer (what a session that cannot author gets instead)
    // ------------------------------------------------------------
    // ONE-WAY, DELIBERATELY. The viewer never imports this module: the three
    // things it needs to do - open a sheet, open the specification, go back to
    // the 3D model - are handed to it as callbacks when its chrome is built, so
    // the pair can never form an import cycle.
    // @delegate: ../80__Feature__WebViewer/
    // ------------------------------------------------------------
    import {
        Na__LeVw__Initialize,
        Na__LeVw__IsViewerMode,
        Na__LeVw__Build,
        Na__LeVw__ShowDrawing,
        Na__LeVw__ShowSpecification,
        Na__LeVw__ShowRegister,
        Na__LeVw__Teardown,
        Na__LeVw__Sync,
        Na__LeVw__SetActive
    } from '../80__Feature__WebViewer/Na__LayoutEditor__WebViewer__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Ids, Classes and Events
    // ------------------------------------------------------------
    const Na__LeMode__CHANGED_EVENT = 'na-layouteditor-mode-changed';
    const Na__LeMode__HOST_ID       = 'naLayoutEditorHost';
    const Na__LeMode__BODY_CLASS    = 'na-layout-editor--active';
    const Na__LeMode__CANVAS_ID     = 'renderCanvas';
    const Na__LeMode__RENDER_HOLD   = 'layout-editor';   // <-- Render loop pause reason while a sheet is open
    const Na__LeMode__VIEW_SHEET    = 'sheet';           // <-- A drawing tab: the sheet, its panels and its tools
    const Na__LeMode__VIEW_REGISTER = 'register';
    const Na__LeMode__VIEW_SPEC     = 'spec';            // <-- The Project Specification tab, over the sheet
    const Na__LeMode__VIEW_STATEMENT = 'statement';      // <-- The Statements tab, over the sheet as the specification is
    // ------------------------------------------------------------

    // MODULE VARIABLES | Context, Shell and State
    // ------------------------------------------------------------
    let Na__LeMode__Context   = null;
    let Na__LeMode__ReadyOnce = null;
    let Na__LeMode__Host      = null;
    let Na__LeMode__Stage     = null;
    let Na__LeMode__Active    = false;
    let Na__LeMode__Built     = false;
    let Na__LeMode__View      = Na__LeMode__VIEW_SHEET;
    let Na__LeMode__Metrics   = false;    // <-- The PDF library's text metrics have been asked for
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Shell
// -----------------------------------------------------------------------------

    // FUNCTION | May This Session Edit Sheets
    // ------------------------------------------------------------
    function Na__LeMode__IsEditable() {
        return Na__DevGate__IsAuthoringEnabled() || !Na__LeCfg__IsReadOnlyOnWeb();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Close the 3D Menus Before the Sheet Takes Over
    // ------------------------------------------------------------
    // The stylesheet hides both dropdown containers while a drawing tab is
    // open, so a menu left open would only reappear on the 3D Model tab.
    // Collapsing the details and their submenu panels here means the 3D view
    // always comes back with the menus shut.
    // ------------------------------------------------------------
    function Na__LeMode__CloseModelMenus() {
        document.querySelectorAll('.na-dropdown-menu__details[open]').forEach((details) => { details.open = false; });
        document.querySelectorAll('.na-dropdown-menu__panel.is-open').forEach((panel) => { panel.classList.remove('is-open'); });
        document.querySelectorAll('.na-dropdown-menu__button[aria-expanded="true"]').forEach((button) => { button.setAttribute('aria-expanded', 'false'); });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Host, Columns, Toolbar and Stage Once
    // ------------------------------------------------------------
    function Na__LeMode__Build() {
        if (Na__LeMode__Built) return;
        Na__LeMode__Built = true;
        const editable = Na__LeMode__IsEditable();
        const viewer   = Na__LeVw__IsViewerMode();
        const toast    = Na__LeMode__Context ? Na__LeMode__Context.showToast : null;

        let host = document.getElementById(Na__LeMode__HOST_ID);
        if (!host) { host = document.createElement('div'); host.id = Na__LeMode__HOST_ID; document.body.appendChild(host); }
        host.className = 'na-le-host';
        host.hidden = true;
        // THE VIEWER GETS A DIFFERENT SHELL, NOT A DISABLED ONE. No panel
        // columns and no toolbar row are built at all, so there is no authoring
        // surface anywhere on the page to leak through a missed guard, and the
        // stage has the whole width - which on a phone in portrait is the
        // difference between a readable drawing and a sliver of one.
        host.innerHTML = viewer
            ? '<div class="na-le-shell na-le-shell--viewer"><div class="na-le-centre"><div class="na-le-stage" tabindex="0"></div></div></div>'
            : '<div class="na-le-shell"><div class="na-le-column na-le-column--left"></div><div class="na-le-centre"><div class="na-le-centre__toolbar"></div><div class="na-le-stage" tabindex="0"></div></div><div class="na-le-column na-le-column--right"></div></div>';
        Na__LeMode__Host  = host;
        Na__LeMode__Stage = host.querySelector('.na-le-stage');

        Na__LeSurface__Mount(Na__LeMode__Stage, { editable : editable });
        Na__LeRegEd__Mount(host, { editable, showToast : toast, navigation : { enter : Na__LeMode__Enter, openRegister : Na__LeMode__OpenRegister } });
        Na__LeStmt__Initialize({ editable : editable, showToast : toast });
        Na__LeStmtPage__Mount(host, { editable : editable, showToast : toast });   // <-- Mounted for the viewer too: a reader gets the Read view and nothing else

        // THE VIEWER | Its own chrome, the specification page, and nothing else
        // ------------------------------------------------------------
        if (viewer) {
            Na__LeVw__Build(host, {                                          // <-- Leaving is the 3D Model tab's, as it is in the editor
                enter    : (sheetId) => Na__LeMode__Enter(sheetId),
                openSpec : ()        => Na__LeMode__OpenSpecification(),
                openRegister : () => Na__LeMode__OpenRegister()
            });
            Na__LeSpecEd__Mount(host, { editable : false, showToast : toast });   // <-- Read view only; the viewer sets it on every show
            return;
        }
        Na__LePanels__Mount({ left : host.querySelector('.na-le-column--left'), right : host.querySelector('.na-le-column--right'), editable : editable, showToast : toast });
        // LEFT COLUMN | Two tabs, as the right column has: the document's own
        // preferences, and the project specification as bubbles to drag in.
        // Everything the column held before the tabs is on the first.
        Na__LePanels__RegisterTab('left', { id : 'document', title : Na__LeCfg__GetLabel('PanelTabDocument', 'Document Preferences'), hint : Na__LeCfg__GetLabel('PanelTabDocumentHint', 'The sheet, its notes margin, its layers and what its drawings show.') });   // <-- First, so every section that names no tab is on it
        Na__LePanelScrapSpec__RegisterTab();                                   // <-- The Specification tab: its one section below names it
        // DOCUMENT PREFERENCES | Sheet, then the three things a drawing is made of:
        // its own layers, the render composites that make its picture, and the
        // model categories that picture is allowed to see. Left to right is
        // now "what is on the paper" against "what the selection's properties
        // are", instead of layers on one side and everything else on the other.
        Na__LePanelSheet__Register();
        Na__LePanelGrid__Register();                                           // <-- Drawing Grid: under Sheet, LayOut's Document Setup > Grid (F6 shows it, F7 snaps to it)
        Na__LePanelMargin__Register();                                         // <-- The sheet's notes margin, beside its other sheet settings
        Na__LePanelLayers__Register();
        Na__LePanelStyles__Register();
        Na__LePanelSpComp__Register();                                         // <-- Site Plan Render Composites: the same controls, the site plan's three decks; hidden off a site plan sheet
        Na__LePanelModelLayers__Register();
        // THE SPECIFICATION TAB | The project's notes, each code in a bubble that is dragged onto the paper
        Na__LePanelScrapSpec__Register();
        // RIGHT COLUMN | Two tabs: the selected item's properties, and the scrapbooks
        Na__LePanels__RegisterTab('right', { id : 'properties', title : Na__LeCfg__GetLabel('PanelTabProperties', 'Properties'), hint : Na__LeCfg__GetLabel('PanelTabPropertiesHint', 'The settings of what is selected on the sheet, or of the next thing each tool places.') });   // <-- First, so every section that names no tab is on it
        Na__LePanelScrap__RegisterTab();                                       // <-- The Scrapbook tab: the three libraries below name it
        Na__LePanelParam__RegisterProperties();                                // <-- First on Properties, and hidden until a parametric element is selected
        Na__LePanelViewport__Register();
        Na__LePanelText__Register();
        Na__LePanelLeaders__Register();
        Na__LePanelDims__Register();
        Na__LePanelShapes__Register();
        Na__LePanelVec__Register();                                            // <-- Vector Tools: straight under Vectors, where Adam drew it - Line, Rectangle, Circle, Arc, Trim, Extend, Join, Split, Offset, Fillet, Chamfer and the settings of whichever is up
        Na__LePanelImages__Register();                                         // <-- Images: the selected picture's file, folder, print resolution, width and frame
        // THE SCRAPBOOK TAB | Three libraries, one way of dropping
        Na__LePanelScrap__Register();                                          // <-- Standard: ready-made items from the config; shown only on a sheet that has some
        Na__LePanelParam__RegisterLibrary();                                   // <-- Parametric: dynamic elements - the scale bar - that keep answering to their parameters
        Na__LePanelScrapCustom__Register();                                    // <-- Custom: items saved from a selection, one JSON file each in the user content folder
        Na__LePanelPatterns__Register();                                       // <-- Patterns: the hatch library and each site plan layer's hatch
        Na__LePanelArea__Register();                                           // <-- Floor Areas: LAST in the right column, below Patterns as Adam asked - the rooms measured on this sheet and what they add up to
        Na__LeToolbar__Mount(host.querySelector('.na-le-centre__toolbar'), { editable : editable, showToast : toast });
        Na__LeMeasure__Mount(host.querySelector('.na-le-centre'), { editable : editable, stage : Na__LeMode__Stage });   // <-- The Measurements box, bottom right over the stage
        Na__LeSpecEd__Mount(host, { editable : editable, showToast : toast });    // <-- The Project Specification page, over the shell
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Sheet's Pointer, Keys and Margin Grip: On and Off Together
    // ------------------------------------------------------------
    // A VIEWER BINDS NOTHING HERE. Its reading input - navigation only, no
    // tools and no margin grip - is bound by Na__LeVw__ShowDrawing when a
    // document is shown, and let go when another one is. Returning early is
    // what keeps the editing tools off a web session's paper: they are never
    // attached rather than attached and told to behave.
    function Na__LeMode__AttachSheetInput() {
        if (Na__LeVw__IsViewerMode()) return;
        Na__LePc__Attach();                                                    // <-- Mouse, wheel and keyboard, before the tools
        Na__LeTouch__Attach();                                                 // <-- Touch, before the tools
        Na__LeTools__Attach({ editable : Na__LeMode__IsEditable() });
        Na__LeGrid__Attach();                                                  // <-- The drawing grid is drawn with the tools, and never for a viewer
        Na__LeAxes__Attach();                                                  // <-- The drawing axes (F9) follow the pointer with the tools, and never for a viewer
        Na__LeMarginGrip__Attach({ editable : Na__LeMode__IsEditable() });
        Na__LeRegionGrip__Attach({ editable : Na__LeMode__IsEditable() });    // <-- Each overspill note region's sides, corners and tab, beside the margin's own grip
        Na__LeImg__AttachInput();                                              // <-- Picture files dropped on the stage land on the sheet
    }
    function Na__LeMode__DetachSheetInput() {
        if (Na__LeVw__IsViewerMode()) return;
        Na__LeImg__DetachInput();                                              // <-- A crop in progress is kept, and drops stop
        Na__LeRegionGrip__Detach();
        Na__LeMarginGrip__Detach();
        Na__LeGrid__Detach();
        Na__LeAxes__Detach();
        Na__LeTools__Detach();
        Na__LeTouch__Detach();
        Na__LePc__Detach();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Drawing Tab Opened From Another Tab: Its Keyboard Started Afresh
    // ------------------------------------------------------------
    // ADAM'S RULE (21-Sep-2026): the drawing tabs' hotkeys are set up again
    // every time a drawing is opened from the 3D Model tab or from a document
    // tab - the Project Specification, the Drawing Register, the Statements -
    // so nothing the other tab left behind follows the user back onto the
    // sheet: a key held, a value half typed, a field holding the focus, a key
    // file that failed to read. In order:
    //   1. every listener off - held keys, half-typed values, a tool half used
    //      and a pan in flight go with them;
    //   2. the drawing tabs' key file read again - the bindings in force stay
    //      until it lands, and a read that fails keeps them;
    //   3. every listener back on, Select up - the resting state;
    //   4. the keyboard given to the sheet: whatever the last tab left the
    //      focus in gives it up to the stage, so the first key is the sheet's.
    // One drawing tab to another keeps its keyboard as it is.
    // ------------------------------------------------------------
    function Na__LeMode__RestartSheetKeys() {
        if (Na__LeVw__IsViewerMode()) return;                                  // <-- A viewer binds its own reading keys when a document is shown
        Na__LeMode__DetachSheetInput();
        void Na__LeCfg__ReloadKeyMap();
        Na__LeMode__AttachSheetInput();
        Na__LePc__TakeKeyboard();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Load the PDF Library's Text Metrics Once, Then Redraw the Paper
    // ------------------------------------------------------------
    // The notes margin wraps its text by measured widths and the title block
    // truncates by them. Until jsPDF and the Open Sans cuts have loaded both
    // fall back to an average character width, so a note could break in one
    // place on screen and in another in the PDF. Asked for on the first
    // entry; the chrome and the markup redraw once they land.
    // ------------------------------------------------------------
    // RETURNS THE PROMISE so the first-open overlay can wait on the same work
    // rather than on a guess at how long it takes. A later call returns null:
    // the load has already been asked for and nobody is waiting on it twice.
    function Na__LeMode__PreloadMetrics() {
        if (Na__LeMode__Metrics) return null;
        Na__LeMode__Metrics = true;
        return Na__LePdf__EnsureJsPdf().then(() => {
            if (!Na__LeMode__Active) return;
            Na__LeSurface__Refresh('chrome');
            Na__LeSurface__Refresh('markup');
        }).catch(() => { Na__LeMode__Metrics = false; });                        // <-- Estimates meanwhile; the next entry asks again
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Which Keyboard Belongs to What Is on Screen
    // ------------------------------------------------------------
    // Handed to Na__AppUtils__KeyScope__ once and asked on every key, so it
    // is read from the state rather than set by each way in and out: no path
    // - a tab, a usage chip, a sheet deleted from under the editor, a tab
    // that fails half way through opening - can leave the wrong keyboard
    // live. A drawing tab is the drawing tools'; the specification, the
    // register and the statements are the documents'.
    // ------------------------------------------------------------
    function Na__LeMode__KeyScope() {
        if (!Na__LeMode__Active) return Na__KeyScope__MODEL;
        return Na__LeMode__View === Na__LeMode__VIEW_SHEET ? Na__KeyScope__SHEET : Na__KeyScope__DOCUMENT;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Announce
    // ------------------------------------------------------------
    function Na__LeMode__Dispatch() {
        const sheet = Na__LeModel__GetActiveSheet();
        Na__LeVw__Sync();                                                      // <-- The viewer's bar and dock follow the same announcement the tab strip does
        window.dispatchEvent(new CustomEvent(Na__LeMode__CHANGED_EVENT, { detail : { isActive : Na__LeMode__Active, sheetId : sheet ? sheet.Sheet__Id : null, view : Na__LeMode__View } }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Enter and Leave
// -----------------------------------------------------------------------------

    // FUNCTION | Open the Editor on a Sheet (the first sheet when none is named)
    // ------------------------------------------------------------
    function Na__LeMode__Enter(sheetId) {
        if (!Na__LeMode__Context || !Na__LeCfg__IsEnabled()) return false;
        Na__LeVeil__Dismiss3d();                                                 // <-- A drawing tab pressed while the model was still settling: its veil goes now
        const sheets = Na__LeModel__GetSheets();
        const sheet  = (sheetId && Na__LeModel__GetSheetById(sheetId)) || sheets[0] || null;
        if (!sheet) return false;
        Na__LeMode__Build();
        const current  = Na__LeModel__GetActiveSheet();
        const fromSpec = Na__LeMode__Active && Na__LeMode__View !== Na__LeMode__VIEW_SHEET;
        const sameSheet = fromSpec && !!current && current.Sheet__Id === sheet.Sheet__Id;

        if (fromSpec) {
            Na__LeRegEd__Hide();
            Na__LeStmtPage__Hide();
            if (!Na__LeVw__IsViewerMode()) Na__LeSpecEd__Hide();                 // <-- Back from the specification: the sheet was kept underneath
            Na__LeMode__View = Na__LeMode__VIEW_SHEET;                           // <-- In the viewer, ShowDrawing puts the specification away below
            Na__LeMode__RestartSheetKeys();                                      // <-- Back from a document tab: the drawing tabs' keyboard started afresh
        }
        if (!Na__LeMode__Active) {
            if (Na__FloorPlanMode__IsEngaged())  Na__FloorPlanMode__ExitPlan(null);          // <-- The editor starts from the 3D view
            if (Na__ElevationMode__IsEngaged())  Na__ElevationMode__ExitElevation(null);
            Na__LeMode__CloseModelMenus();                                     // <-- The menus belong to the 3D Model tab
            document.body.classList.add(Na__LeMode__BODY_CLASS);
            const canvas = document.getElementById(Na__LeMode__CANVAS_ID);
            if (canvas) canvas.style.visibility = 'hidden';                     // <-- Alive for offscreen snapshots
            Na__LeMode__Host.hidden = false;
            Na__LeMode__Active = true;
            Na__LeVw__SetActive(true);                                       // <-- The viewer's body class: the stylesheet only then reshapes the shell
            Na__RenderLoop__Pause(Na__LeMode__RENDER_HOLD);                  // <-- Engine idle: the sheet owns the screen; snapshots render offscreen on demand
            Na__DrawView__Transitions__SuspendThreeD({ returnToOrbit : true });   // <-- Walk or Fly left for Orbit, the whole exit; orbit and distance culling let go, as in a drawing
            Na__LeSnap__ResetFingerprints();                                // <-- One model walk per session, not per refresh
            Na__LeMode__RestartSheetKeys();                                // <-- Pointer, keys, tools and the margin grip, started afresh from the 3D Model tab
        }
        const specLoad    = Na__LeSpec__EnsureLoaded();                    // <-- The specification is read when the drawing editor first opens, never before
        const metricsLoad = Na__LeMode__PreloadMetrics();

        // THE FIRST DRAWING TAB OF A SESSION IS THE EXPENSIVE ONE - the
        // specification over the network, the PDF fonts, and every viewport
        // rendered from the model for the first time. Na__LeFirst__Begin waits
        // on exactly those three and puts a spinner up only if they are still
        // going after about half a second, so a machine that opens instantly
        // still opens instantly. It answers once per session and is a no-op
        // afterwards, so this can sit on the ordinary path.
        // The viewport count is read from the MODEL, here, before the surface
        // has drawn anything. That is what lets the overlay tell "nought of two
        // drawn" from "finished": the sheet's pictures are queued a good half
        // second after the tab is pressed, so anything that only watched the
        // render queue would call itself done before the first one started.
        // THE VIEWER HAS ITS OWN LOADING SCREEN (Na__PubDoc__LoadingScreen__),
        // named for each drawing and lifted when that drawing's files are all
        // on the page, on EVERY tab press - so this first-open veil, which would
        // stack on top of it, is the editor's alone.
        if (!Na__LeVw__IsViewerMode()) void Na__LeVeil__FirstOpen(Na__LeMode__Host, {
            specification : specLoad,
            textMetrics   : metricsLoad,
            viewportCount : (Na__LeModel__GetViewports(sheet) || []).length
        });
        Na__LeModel__SetActiveSheetId(sheet.Sheet__Id);
        Na__LeHist__Track(sheet);                                          // <-- Undo baseline for this sheet
        if (sameSheet) {                                                   // <-- Same sheet: keep its zoom and scroll, catch up with what changed meanwhile
            Na__LeSurface__Refresh('markup');
            Na__LePanels__Refresh();
            if (Na__LeVw__IsViewerMode()) Na__LeVw__ShowDrawing(sheet, { fit : false });   // <-- The reading input comes back; the view stays where it was
            Na__LeMode__Dispatch();
            return true;
        }
        // THE WEB VIEWER NEVER RENDERS A SHEET. SetSheet builds every viewport
        // frame and renders it on this device - the work that crashes phones -
        // so the viewer skips it and shows the PUBLISHED drawing instead
        // (Na__LeVw__ShowDrawing -> 52__System__Layout__PublishedDocuments),
        // fitting it once its paper is known. The editor path is unchanged.
        if (!Na__LeVw__IsViewerMode()) Na__LeSurface__SetSheet(sheet);
        Na__LePanels__Refresh();
        if (Na__LeVw__IsViewerMode()) Na__LeVw__ShowDrawing(sheet);
        else window.requestAnimationFrame(() => { if (Na__LeMode__Active) Na__LeNav__Fit(); });   // <-- Stage has a size once shown
        Na__LeMode__Dispatch();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Editor and Give the 3D View Back
    // ------------------------------------------------------------
    function Na__LeMode__Leave() {
        Na__LeRegEd__Hide();
        Na__LeStmtPage__Hide();                                                 // <-- Writes whatever was typed to disk on the way out
        if (!Na__LeMode__Active) return false;
        if (Na__LeVw__IsViewerMode()) Na__LeVw__Teardown();                     // <-- Both reading surfaces let go, whichever was showing
        else if (Na__LeMode__View === Na__LeMode__VIEW_SPEC) Na__LeSpecEd__Hide();   // <-- The sheet's input already stood down when the page opened
        else Na__LeMode__DetachSheetInput();
        Na__LeMode__View = Na__LeMode__VIEW_SHEET;
        Na__LeSurface__SetSheet(null);
        Na__LeOsnap__Clear();
        Na__LeModel__SetActiveSheetId(null);
        Na__LeMode__Host.hidden = true;
        document.body.classList.remove(Na__LeMode__BODY_CLASS);
        Na__LeVw__SetActive(false);
        const canvas = document.getElementById(Na__LeMode__CANVAS_ID);
        if (canvas) canvas.style.visibility = '';
        Na__LeMode__Active = false;
        Na__DrawView__Transitions__ResumeThreeD();                          // <-- Orbit and culling back before the first 3D frame
        Na__RenderLoop__Resume(Na__LeMode__RENDER_HOLD);                    // <-- Engine runs again; one frame paints now
        Na__RenderLoop__RequestRender();

        // THE MODEL IS NOT READY TO BE LOOKED AT THE INSTANT THE ENGINE
        // RESTARTS. It flicks through stale 2D viewport frames first, and the
        // camera is still parked wherever the reader left it rather than on a
        // composed view. So the veil goes up at once, the camera is sent to the
        // first presentation scene, and it lifts when the camera reports it has
        // arrived - after the engine is resumed, because a paused engine would
        // never animate the move.
        void Na__LeVeil__ReturnTo3d();

        Na__LeMode__Dispatch();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Page Up / Page Down: the Drawing Before or After This One
    // ------------------------------------------------------------
    // Asked by the PC controls (Na__LePc__STEP_SHEET_EVENT). In tab order, and
    // through Enter, so it is exactly the tab beside this one being clicked:
    // the undo baseline, the panels, the fit and the tab strip all follow.
    // Only a drawing turns to a drawing - the first and the last are ends,
    // not a loop, and the documents after the drawings are never reached this
    // way. The web viewer's reading keys ask the same question.
    // ------------------------------------------------------------
    function Na__LeMode__StepSheet(direction) {
        if (!Na__LeMode__Active || Na__LeMode__View !== Na__LeMode__VIEW_SHEET) return false;
        const sheets  = Na__LeModel__GetSheets();
        const current = Na__LeModel__GetActiveSheet();
        const at      = current ? sheets.findIndex((sheet) => sheet.Sheet__Id === current.Sheet__Id) : -1;
        const next    = at === -1 ? null : sheets[at + (direction < 0 ? -1 : 1)];
        if (!next) return false;                                                // <-- Already at an end
        Na__LeText__Commit();                                                   // <-- Typing on the paper is kept, as a tab click keeps it by blurring the field
        return Na__LeMode__Enter(next.Sheet__Id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Ctrl+S Saves, From Anywhere in the Editor
    // ------------------------------------------------------------
    // WHY THIS IS NOT WITH THE OTHER EDIT CHORDS. Ctrl+Z, Ctrl+C and the rest
    // are answered by the sheet's own keyboard, which is attached only while a
    // drawing tab is up - on the specification or the register it has stood
    // down. Saving must work on all three, so it is answered here, once, for
    // as long as the editor is open, and the sheet's keyboard is left alone.
    //
    // WHAT IT COMMITS FIRST. Clicking the Save button blurs whatever had focus,
    // and that blur is what commits a panel field: those report on 'change',
    // which fires on blur or Enter and not on every keystroke. A keyboard
    // shortcut blurs nothing, so a half-typed dimension offset would have been
    // saved at its old value. Typing on the paper is committed the way the
    // specification and register tabs already commit it, and a focused field
    // inside the editor is blurred - the same commit the button always got for
    // free. Focus is not put back afterwards, because that is what the button
    // does too and a field rebuilt by its own change event is gone by then.
    //
    // THE KEY IS ALWAYS TAKEN while an editable editor is open, even when the
    // save is a no-op, because the alternative is the browser offering to save
    // the page as a file over the top of a drawing. A read-only viewer keeps
    // its own Ctrl+S: there is nothing there to save.
    //
    // A DOCUMENT WITH A SAVE OF ITS OWN GETS THE KEY FIRST. The documents'
    // keyboard (Na__LayoutEditor__DocumentKeys__) listens on the window in the
    // capture phase, ahead of this, so on the Statements tab Ctrl+S writes the
    // statement, and on the Drawing Register it saves the revision notes to R2
    // and the project file; neither key arrives here. The specification has
    // no save of its own, so its key comes on to this one, which syncs it.
    // ------------------------------------------------------------
    function Na__LeMode__OnSaveKey(event) {
        if (!Na__LeMode__Active || !Na__LeMode__IsEditable()) return;            // <-- Read-only sessions keep the browser's key
        if (event.defaultPrevented || event.repeat) return;
        const match = Na__LeCfg__MatchKeyBinding(event.key, {
            Ctrl : event.ctrlKey, Shift : event.shiftKey, Alt : event.altKey, Meta : event.metaKey, Space : false
        });
        if (!match || match.action !== 'Edit__Save') return;

        event.preventDefault();                                                  // <-- Never the browser's Save Page dialog over a sheet
        event.stopPropagation();

        Na__LeText__Commit();                                                    // <-- Typing on the paper is kept
        const focused = document.activeElement;                                  // <-- A panel field reports on 'change': blur is what commits it
        if (focused && focused !== document.body && Na__LeMode__Host && Na__LeMode__Host.contains(focused) && typeof focused.blur === 'function') focused.blur();

        void Na__LeToolbar__Save();                                              // <-- The Save Sheets action itself, busy guard and toast included
    }
    // ------------------------------------------------------------


    // FUNCTION | Show the Project Specification Tab
    // ------------------------------------------------------------
    // Over the sheet, which stays laid out underneath: its tools, keys and
    // margin grip stand down, a text field still open on the paper is
    // committed first. noteId brings that note into view. A request while no
    // drawing tab is open opens the first sheet underneath it first.
    // ------------------------------------------------------------
    function Na__LeMode__OpenSpecification(noteId) {
        Na__LeRegEd__Hide();
        Na__LeStmtPage__Hide();
        if (!Na__LeMode__Active && !Na__LeMode__Enter(null)) return false;
        void Na__LeSpec__EnsureLoaded();
        if (Na__LeMode__View !== Na__LeMode__VIEW_SPEC) {
            Na__LeText__Commit();                                              // <-- Typing on the paper is kept, not dropped by the tools standing down
            Na__LeMode__DetachSheetInput();
            Na__LeMode__View = Na__LeMode__VIEW_SPEC;
        }
        // THE VIEWER SHOWS THE DOCUMENT, NOT THE AUTHORING PAGE. noteId is a
        // request from a bubble on a sheet to open the note that is being
        // edited, which no reading session can make; the pages are shown from
        // the top instead of jumping into a note nobody asked for.
        if (Na__LeVw__IsViewerMode()) { Na__LeVw__ShowSpecification(); Na__LeMode__Dispatch(); return true; }
        Na__LeSpecEd__Show({ noteId : (typeof noteId === 'string' && noteId) ? noteId : null });
        Na__LeMode__Dispatch();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | State
    // ------------------------------------------------------------
    // FUNCTION | Open the Pack Register Beside the Specification
    // ------------------------------------------------------------
    function Na__LeMode__OpenRegister() {
        if (!Na__LeMode__Active && !Na__LeMode__Enter(null)) return false;
        Na__LeText__Commit();
        Na__LeMode__DetachSheetInput();
        Na__LeSpecEd__Hide();
        Na__LeStmtPage__Hide();
        if (Na__LeVw__IsViewerMode()) Na__LeVw__ShowRegister();
        Na__LeMode__View = Na__LeMode__VIEW_REGISTER;
        Na__LeRegEd__Show();
        Na__LeMode__Dispatch();
        return true;
    }
    // ------------------------------------------------------------

    // FUNCTION | Show the Statements Tab
    // ------------------------------------------------------------
    // Over the sheet, exactly as the specification is: the sheet stays laid
    // out underneath, its tools and keys stand down, and a text field still
    // open on the paper is committed first so nothing typed is dropped.
    // A request while no drawing tab is open opens the first sheet under it.
    //
    // THE VIEWER GETS THE SAME PAGE. It was mounted read-only, so a reader
    // sees the statement and no authoring surface at all - there is no
    // separate viewer route to keep in step.
    // ------------------------------------------------------------
    function Na__LeMode__OpenStatements() {
        if (!Na__LeMode__Active && !Na__LeMode__Enter(null)) return false;
        Na__LeRegEd__Hide();
        Na__LeSpecEd__Hide();
        if (Na__LeMode__View !== Na__LeMode__VIEW_STATEMENT) {
            Na__LeText__Commit();                                              // <-- Typing on the paper is kept, not dropped by the tools standing down
            Na__LeMode__DetachSheetInput();
            Na__LeMode__View = Na__LeMode__VIEW_STATEMENT;
        }
        void Na__LeStmtPage__Show();
        Na__LeMode__Dispatch();
        return true;
    }
    // ------------------------------------------------------------


    function Na__LeMode__IsActive() { return Na__LeMode__Active; }
    function Na__LeMode__Ready()    { return Na__LeMode__ReadyOnce || Promise.resolve(false); }
    function Na__LeMode__GetView()  { return Na__LeMode__View; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Model and Request Handling
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Which Model Reasons Redraw the Sheet's Own Markup
    // ------------------------------------------------------------
    // EVERY markup kind must be listed. Shapes were missing from this route
    // for a fortnight and the symptom was baffling rather than obvious: the
    // model updated, the undo stack recorded it, the sheet was marked dirty -
    // and nothing redrew, so a deleted vector sat on the paper and a restyled
    // one kept its old colour until some unrelated edit forced a repaint. It
    // read as "the editor is slow", not "the editor never drew it".
    //
    // Singular is one item changing, plural is the collection changing (an
    // add or a delete). The model dispatches both spellings, so both are here.
    // ------------------------------------------------------------
    const Na__LeMode__MARKUP_REASONS = Object.freeze([
        'annotation', 'annotations',
        'dimension',  'dimensions',
        'shape',      'shapes',
        'leader',     'leaders',
        'group',      'groups',
        'areas',                                                                // <-- A room's name, the group it is filed under, or the sheet's group list: all of it is drawn on the paper
        'margin'                                                                // <-- The notes margin is drawn with the markup
    ]);
    // ------------------------------------------------------------


    // HELPER FUNCTION | The One Panel a Change Concerns (null means all of them)
    // ------------------------------------------------------------
    // Refreshing all eight sections on every keystroke-sized change rebuilt a
    // lot of DOM nobody was looking at. A change to a text, a dimension or a
    // vector is shown by exactly one panel, so only that panel is asked.
    //
    // VIEWPORT CHANGES STILL REFRESH EVERYTHING, on purpose. Three sections
    // describe the selected viewport - Viewport, Render Composites and Model
    // Layers - and they reach it through the selection rather than naming the
    // record, so a narrowed refresh would leave two of them showing the state
    // from before the click. A viewport commit happens once per drag, not once
    // per move, so the full refresh costs nothing anyone can feel.
    // ------------------------------------------------------------
    function Na__LeMode__PanelFor(reason) {
        if (reason === 'annotation' || reason === 'annotations') return 'text';
        if (reason === 'dimension'  || reason === 'dimensions')  return 'dimensions';
        if (reason === 'shape'      || reason === 'shapes')      return 'shapes';
        if (reason === 'leader'     || reason === 'leaders')     return 'leaders';
        if (reason === 'margin')                                 return 'margin';
        if (reason === 'areas')                                  return 'floor-areas';
        return null;                                                            // <-- Viewports and structural changes: everything may have moved
    }
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Answer That Folds the Whole Group
    // ------------------------------------------------------------
    const Na__LeMode__FOLD_GROUP = '';                                          // <-- Not null, which leaves the folds alone
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Section That Edits a Kind of Sheet Item
    // ------------------------------------------------------------
    // The selection side of PanelFor, which answers the same question for a
    // change announcement. Three kinds of answer:
    //   a section id   open it and fold the rest of the group
    //   FOLD_GROUP     no section of the group edits this: fold them all
    //   null           leave the folds alone (a group, anything unknown)
    // ------------------------------------------------------------
    function Na__LeMode__SectionForKind(kind, items) {
        if (kind === 'annotation') return 'text';
        if (kind === 'dimension')  return 'dimensions';
        // A MEASURED ROOM IS A VECTOR, AND ITS PANEL IS NOT THE VECTORS ONE.
        // Everything somebody wants the moment they select one - its name, its
        // group, what it measures - is in Floor Areas, so that is what opens.
        // The Vectors panel is still there for its edge and its hatch, one
        // fold away, because a room IS a vector.
        // A PICTURE IS A VECTOR TOO, and its panel is Images: its file, the
        // folder its drawing's number files it in, and its print resolution
        // are what is wanted the moment one is selected.
        if (kind === 'shape')      return Na__LeMode__AllAreas(items) ? 'floor-areas' : (Na__LeMode__AllImages(items) ? 'images' : 'shapes');
        if (kind === 'leader')     return 'leaders';
        // A VIEWPORT FOLDS THE GROUP. Its own section is not one of them, and
        // leaving the markup sections as they were - the choice made in
        // v2.57.0 - left Floor Areas and Patterns standing open over a selected
        // drawing, which is the clutter the group exists to prevent. Adam:
        // "They should only be open when active." A site plan viewport is the
        // one drawing a group section edits - its hatches are Patterns' - so
        // one of those opens Patterns instead.
        if (kind === 'viewport')   return Na__LeMode__OneSitePlan(items) ? 'patterns' : Na__LeMode__FOLD_GROUP;
        return null;
    }
    function Na__LeMode__OneSitePlan(items) {
        const sheet     = Na__LeModel__GetActiveSheet();
        const viewports = (Array.isArray(items) ? items : []).filter((item) => item && item.kind === 'viewport');
        if (!sheet || viewports.length !== 1) return false;                     // <-- Patterns edits one viewport's layers at a time
        const viewport = Na__LeModel__GetViewportById(sheet, viewports[0].id);
        return !!viewport && Na__LeModel__IsSitePlanViewport(viewport);
    }
    function Na__LeMode__AllImages(items) {
        const sheet  = Na__LeModel__GetActiveSheet();
        const shapes = (Array.isArray(items) ? items : []).filter((item) => item && item.kind === 'shape');
        if (!sheet || !shapes.length) return false;
        return shapes.every((item) => Na__LeImg__Is(Na__LeModel__GetShapeById(sheet, item.id)));
    }
    function Na__LeMode__AllAreas(items) {
        const sheet = Na__LeModel__GetActiveSheet();
        const shapes = (Array.isArray(items) ? items : []).filter((item) => item && item.kind === 'shape');
        if (!sheet || !shapes.length) return false;
        return shapes.every((item) => Na__LeArea__Is(Na__LeModel__GetShapeById(sheet, item.id)));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Section for What Is Selected, Fold the Rest
    // ------------------------------------------------------------
    // Called on every selection change and whenever the eyedropper picks up a
    // style. ONE KIND, ONE PANEL: a selection of several vectors opens Vectors,
    // and a mixed selection opens nothing, because there is no single answer to
    // what would be edited. Groups are opened up first, so windowing a grouped
    // block of notes still lands on Leaders.
    // ------------------------------------------------------------
    function Na__LeMode__FocusPanelFor(kind, items) {
        if (!Na__LeMode__Active || !Na__LeCfg__GetPanelSetup().focusOnSelect) return false;
        const section = Na__LeMode__SectionForKind(kind, items);
        if (section === null) return false;                                     // <-- Nothing to say: the folds stay as they are
        return Na__LePanels__FocusSection(section || null);                     // <-- FOLD_GROUP: no id folds the whole group
    }
    function Na__LeMode__FocusPanelForSelection() {
        const items = Na__LeModel__GetSelectionItems();
        if (!items.length) return false;                                        // <-- Nothing selected: the folds are the user's again
        const opened = Na__LeGroup__Expand(Na__LeModel__GetActiveSheet(), items);
        const kinds  = new Set(opened.map((item) => item.kind));
        kinds.delete('group');
        if (kinds.size !== 1) return false;                                     // <-- Mixed: no one panel describes it
        return Na__LeMode__FocusPanelFor(kinds.values().next().value, opened);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Route a Model Change to the Right Refresh
    // ------------------------------------------------------------
    function Na__LeMode__OnSheetsChanged(event) {
        if (!Na__LeMode__Active) return;
        const reason = event.detail ? event.detail.reason : 'all';
        const active = Na__LeModel__GetActiveSheet();
        // THE WEB VIEWER NEVER RENDERS A SHEET, and this is the other way into
        // SetSheet: pressing a drawing tab makes its sheet active, and that
        // change lands here BEFORE Enter reaches its own viewer branch - so a
        // phone was still rendering every viewport of the sheet it had just
        // been told to show published. The viewer's paper holds a published
        // drawing and only Na__LeVw__ShowDrawing changes it.
        if (Na__LeVw__IsViewerMode()) {
            if (reason === 'loaded' || reason === 'sheet-deleted') {
                if (!active) { const first = Na__LeModel__GetSheets()[0]; if (first) Na__LeMode__Enter(first.Sheet__Id); else Na__LeMode__Leave(); return; }
                Na__LeVw__ShowDrawing(active, { fit : false });
            }
            Na__LePanels__Refresh(Na__LeMode__PanelFor(reason));
            return;
        }
        if (reason === 'loaded' || reason === 'sheet-deleted') {
            if (!active) { const first = Na__LeModel__GetSheets()[0]; if (first) Na__LeMode__Enter(first.Sheet__Id); else Na__LeMode__Leave(); return; }
            Na__LeSurface__SetSheet(active);
        } else if (reason === 'register-updated') Na__LeSurface__Refresh('chrome');
        else if (reason === 'sheet-updated' || reason === 'fields') Na__LeSurface__Refresh(reason === 'fields' ? 'chrome' : 'sheet');
        else if (reason === 'viewports' || reason === 'viewport') Na__LeSurface__Refresh('frames');
        else if (Na__LeMode__MARKUP_REASONS.indexOf(reason) !== -1) Na__LeSurface__Refresh('markup');
        else if (reason === 'layers') Na__LeSurface__Refresh('all');
        else if (reason === 'selection') { Na__LeSurface__Refresh('markup'); Na__LeSurface__Refresh('selection'); Na__LeMode__FocusPanelForSelection(); }
        else if (reason === 'active') { if (active) Na__LeSurface__SetSheet(active); }
        Na__LePanels__Refresh(Na__LeMode__PanelFor(reason));
        if (reason === 'leader' || reason === 'leaders') Na__LePanels__Refresh('margin');   // <-- A link made or lost changes what the notes margin lists
        if (reason === 'shape' || reason === 'shapes') Na__LePanels__Refresh('images');     // <-- A picture is a shape: its width, frame and resolution follow it
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Edit In Drawing: Leave, Then Open the Plan or Elevation in Edit Mode
    // ------------------------------------------------------------
    function Na__LeMode__OnRequestDrawing(event) {
        const detail = event.detail || {};
        if (!detail.plan && !detail.elevation) return;
        Na__LeMode__Leave();
        if (detail.plan) { Na__FloorPlanMode__EnterPlan(detail.plan); Na__FloorPlanMode__SetEditMode(true); }
        else { Na__ElevationMode__EnterElevation(detail.elevation); Na__ElevationMode__SetEditMode(true); }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Render Context and Load the Config
    // ------------------------------------------------------------
    // context: { renderer, scene, camera, controls, pipelineRef, modelRoot, appConfig, showToast }
    // Resolves to true when the feature is enabled.
    // ------------------------------------------------------------
    function Na__LeMode__Initialize(context) {
        if (!context) return Promise.resolve(false);
        Na__LeMode__Context = context;
        Na__KeyScope__Follow(Na__LeMode__KeyScope);                              // <-- Which keyboard is live is this module's to answer, asked afresh on every key
        Na__LeCfg__SetAppConfig(context.appConfig || null);
        // THE EDGE STYLE AND COMPOSITE CONFIGS LOAD WITH THE EDITOR'S OWN. The
        // record normaliser prunes a stored edge style that matches its default,
        // and it can only do that honestly once the defaults are known; waiting
        // here means the first sheet a project opens is normalised against the
        // real files rather than the built-in fallbacks. Neither fetch rejects,
        // so a missing file slows nothing and blocks nothing.
        // AND THE DRAWING VIEW CONFIG, because every viewport bake renders through
        // the drawing presets and they read their setup from it. index.html starts
        // the fetch; this is the same promise, so it is waited for, never repeated.
        Na__LeMode__ReadyOnce = Promise.all([ Na__LeCfg__Ready(), Na__LeEdge__Ready(), Na__LeComposite__Ready(), Na__LeGrad__Ready(), Na__LeDash__Ready(), Na__LeHatch__Ready(), Na__LeSpComp__Ready(), Na__LeArea__Ready(), Na__LeDocKeys__Ready(), Na__LeImg__Ready(), Na__DrawCfg__Load() ]).then(() => {
            if (!Na__LeCfg__IsEnabled()) return false;
            Na__LeVw__Initialize({ editable : Na__LeMode__IsEditable(), showToast : context.showToast || null });   // <-- Asked before anything is built: the shell it gets depends on the answer
            Na__LeModel__Initialize();
            Na__LeHist__Initialize();                                        // <-- Undo and redo listen to the model from the start
            Na__LeVec__Initialize();                                         // <-- What is drawn inside a group that is open for editing joins that group, just before the change is announced, so the history's one step holds both
            Na__LeAuto__Initialize({ showToast : context.showToast || null, editable : Na__LeMode__IsEditable() });   // <-- Browser draft and structural auto save
            const registerOptions = { editable : Na__LeMode__IsEditable(), showToast : context.showToast || null };
            Na__LeReg__Initialize(registerOptions);
            Na__LeRegEdit__Initialize(registerOptions);
            Na__LeSpec__Initialize({ showToast : context.showToast || null, editable : Na__LeMode__IsEditable() });   // <-- The project specification: nothing is read until the editor opens
            Na__LeSpecLink__Initialize();                                    // <-- Bubble codes follow their notes
            Na__LeSnap__Initialize(context);
            Na__LeSource__Initialize();                                      // <-- How many design phases stay loaded off-scene
            Na__LeViewId__Initialize();                                      // <-- Unnamed elevation viewports are named from their model and the project's north
            Na__LeAreaTable__Attach();                                       // <-- Area schedules follow the rooms they report, inside the same undo step
            Na__LeImg__Initialize({ editable : Na__LeMode__IsEditable(), showToast : context.showToast || null });   // <-- Pictures: the source for everyone; the save step, grips and drop for the editor
            window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeMode__OnSheetsChanged);
            Na__LeDocKeys__Initialize();                                     // <-- The documents' own keyboard: on the window in the capture phase, so it hears a key before anything else
            document.addEventListener('keydown', Na__LeMode__OnSaveKey, true);   // <-- Ctrl+S on the sheet, the specification and the register alike; capture, so it is answered before the browser is told

            window.addEventListener(Na__LeTools__DEFAULTS_EVENT, (event) => { if (Na__LeMode__Active) Na__LePanels__Refresh(Na__LeMode__PanelFor(event.detail && event.detail.kind)); });   // <-- A palette sync: the panel showing the new-object settings redraws
            window.addEventListener(Na__LeDrop__CHANGED_EVENT, (event) => {     // <-- Picking a style says what is being matched, the same way a selection does
                if (event.detail && event.detail.hasSource) Na__LeMode__FocusPanelFor(event.detail.kind);
            });
            window.addEventListener(Na__LePanelViewport__EDIT_EVENT, Na__LeMode__OnRequestDrawing);
            window.addEventListener(Na__LePc__STEP_SHEET_EVENT, (event) => { Na__LeMode__StepSheet(event.detail ? event.detail.direction : 1); });   // <-- Page Up / Page Down on a drawing
            // THE SPECIFICATION CHANGED: bubble codes and notes margins redraw, and
            // the two panels that describe them. Covered by the specification's
            // own page, the sheet catches up when a sheet tab is chosen again.
            window.addEventListener(Na__LeSpec__CHANGED_EVENT, () => {
                if (!Na__LeMode__Active || Na__LeMode__View === Na__LeMode__VIEW_SPEC) return;
                Na__LeSurface__Refresh('markup');
                Na__LePanels__Refresh('leaders');
                Na__LePanels__Refresh('margin');
            });
            window.addEventListener(Na__LeSpec__OPEN_EVENT, (event) => { Na__LeMode__OpenSpecification(event.detail && event.detail.noteId); });
            window.addEventListener(Na__LeStmt__OPEN_EVENT, () => { Na__LeMode__OpenStatements(); });
            window.addEventListener(Na__LeSpec__GOTO_EVENT, (event) => {     // <-- A usage chip: the sheet, with its bubble selected
                const detail = event.detail || {};
                if (!detail.sheetId || !Na__LeMode__Enter(detail.sheetId)) return;
                if (detail.leaderId) Na__LeModel__SetSelection({ kind : 'leader', id : detail.leaderId });
            });
            window.addEventListener(Na__PlPipe__CHANGED_EVENT, (event) => {
                if (!Na__LeMode__Active) return;
                const detail = event.detail || {};
                if (detail.status && detail.status !== Na__PlPipe__STATUS_READY) return;   // <-- Only finished linework repaints the frames
                Na__LeSurface__Refresh('frames');
            });
            // A DESIGN PHASE LOADED, FAILED, WENT, OR MOVED INTO THE 3D VIEW: every
            // frame re-resolves what it draws. The panels follow every change but
            // the per-file progress, which only the frames' badges show - a panel
            // refresh refills selects, and one per model file would snap an open
            // dropdown shut while a phase loads.
            window.addEventListener(Na__PhaseLib__CHANGED_EVENT, (event) => {
                if (!Na__LeMode__Active) return;
                Na__LeSurface__Refresh('frames');
                if (!event.detail || event.detail.kind !== 'progress') Na__LePanels__Refresh();
            });
            window.addEventListener('resize', () => { if (Na__LeMode__Active) Na__LeSurface__SetZoom(Na__LeSurface__GetZoom()); });
            window.addEventListener(Na__LeRaster__CHANGED_EVENT, () => { if (Na__LeMode__Active) Na__LeSurface__Refresh('frames'); });   // <-- A new working level re-renders the pictures
            console.log('[TrueVision3D] Layout Editor ready (' + (Na__LeMode__IsEditable() ? 'editable' : (Na__LeVw__IsViewerMode() ? 'web document viewer, read-only' : Na__LeCfg__GetLabel('ReadOnlyNote', 'read-only'))) + ').');
            return true;
        }).catch((error) => {
            console.error('[TrueVision3D] Layout Editor failed to initialise:', error);
            return false;
        });
        return Na__LeMode__ReadyOnce;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Mode Controller API
    // ------------------------------------------------------------
    export {
        Na__LeMode__CHANGED_EVENT,
        Na__LeMode__VIEW_SHEET,
        Na__LeMode__VIEW_SPEC,
        Na__LeMode__VIEW_REGISTER,
        Na__LeMode__VIEW_STATEMENT,
        Na__LeMode__Initialize,
        Na__LeMode__Ready,
        Na__LeMode__Enter,
        Na__LeMode__Leave,
        Na__LeMode__OpenSpecification,
        Na__LeMode__OpenRegister,
        Na__LeMode__OpenStatements,
        Na__LeMode__IsActive,
        Na__LeMode__IsEditable,
        Na__LeMode__GetView
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
