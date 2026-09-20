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
    import { Na__LeCfg__SetAppConfig, Na__LeCfg__Ready, Na__LeCfg__IsEnabled, Na__LeCfg__IsReadOnlyOnWeb, Na__LeCfg__GetLabel, Na__LeCfg__GetPanelSetup, Na__LeCfg__MatchKeyBinding } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeVeil__FirstOpen, Na__LeVeil__ReturnTo3d, Na__LeVeil__Dismiss3d } from './Na__LayoutEditor__LoadingVeil__.js';
    import { Na__LeEdge__Ready } from '../25__System__RenderStyles/Na__LayoutEditor__EdgeStyles__.js';
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
        Na__LeModel__GetViewports
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__Mount, Na__LeSurface__SetSheet, Na__LeSurface__Refresh, Na__LeSurface__SetZoom, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeNav__Fit } from '../10__Core__SheetSurface/Na__LayoutEditor__Navigation__.js';
    import { Na__LePc__Attach, Na__LePc__Detach } from '../10__Core__SheetSurface/Na__LayoutEditor__Controls__Pc__.js';
    import { Na__LeTouch__Attach, Na__LeTouch__Detach } from '../10__Core__SheetSurface/Na__LayoutEditor__Controls__TouchScreen__.js';
    import { Na__LeTools__DEFAULTS_EVENT, Na__LeTools__Attach, Na__LeTools__Detach } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LePanels__Mount, Na__LePanels__Refresh, Na__LePanels__FocusSection, Na__LePanels__RegisterTab } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import { Na__LeGroup__Expand } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeDrop__CHANGED_EVENT } from '../30__System__SheetTools/Na__LayoutEditor__Eyedropper__.js';
    import { Na__LePanelLayers__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Layers__.js';
    import { Na__LePanelSheet__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Sheet__.js';
    import { Na__LePanelScrap__Register, Na__LePanelScrap__RegisterTab } from '../55__Feature__Scrapbook/Na__LayoutEditor__Panel__Scrapbook__.js';
    import { Na__LePanelScrapCustom__Register } from '../56__Feature__ScrapbookCustom/Na__LayoutEditor__Panel__ScrapbookCustom__.js';
    import { Na__LePanelParam__RegisterLibrary, Na__LePanelParam__RegisterProperties } from '../57__Feature__ScrapbookParametric/Na__LayoutEditor__Panel__ScrapbookParametric__.js';
    import { Na__LePanelViewport__EDIT_EVENT, Na__LePanelViewport__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__ViewportSettings__.js';
    import { Na__LePanelText__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Text__.js';
    import { Na__LePanelLeaders__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Leaders__.js';
    import { Na__LePanelDims__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Dimensions__.js';
    import { Na__LePanelShapes__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Shapes__.js';
    import { Na__LePanelStyles__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__Styles__.js';
    import { Na__LePanelModelLayers__Register } from '../40__Ui__Panels/Na__LayoutEditor__Panel__ModelLayers__.js';
    import { Na__LeToolbar__Mount, Na__LeToolbar__Save } from '../40__Ui__Panels/Na__LayoutEditor__Toolbar__.js';
    import { Na__LeMeasure__Mount } from '../30__System__SheetTools/Na__LayoutEditor__Measurements__.js';
    import { Na__LeSnap__Initialize, Na__LeSnap__ResetFingerprints } from '../25__System__RenderStyles/Na__LayoutEditor__SnapshotRenderer__.js';
    import { Na__LeOsnap__Clear } from '../30__System__SheetTools/Na__LayoutEditor__Snapping__.js';
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
    import { Na__LeSpecEd__Mount, Na__LeSpecEd__Show, Na__LeSpecEd__Hide } from '../50__Feature__Specification/Na__LayoutEditor__SpecEditor__.js';
    import { Na__LeMarginGrip__Attach, Na__LeMarginGrip__Detach } from '../50__Feature__Specification/Na__LayoutEditor__MarginGrip__.js';
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
        // LEFT COLUMN | Sheet, then the three things a drawing is made of:
        // its own layers, the render composites that make its picture, and the
        // model categories that picture is allowed to see. Left to right is
        // now "what is on the paper" against "what the selection's properties
        // are", instead of layers on one side and everything else on the other.
        Na__LePanelSheet__Register();
        Na__LePanelMargin__Register();                                         // <-- The sheet's notes margin, beside its other sheet settings
        Na__LePanelLayers__Register();
        Na__LePanelStyles__Register();
        Na__LePanelModelLayers__Register();
        // RIGHT COLUMN | Two tabs: the selected item's properties, and the scrapbooks
        Na__LePanels__RegisterTab('right', { id : 'properties', title : Na__LeCfg__GetLabel('PanelTabProperties', 'Properties') });   // <-- First, so every section that names no tab is on it
        Na__LePanelScrap__RegisterTab();                                       // <-- The Scrapbook tab: the three libraries below name it
        Na__LePanelParam__RegisterProperties();                                // <-- First on Properties, and hidden until a parametric element is selected
        Na__LePanelViewport__Register();
        Na__LePanelText__Register();
        Na__LePanelLeaders__Register();
        Na__LePanelDims__Register();
        Na__LePanelShapes__Register();
        // THE SCRAPBOOK TAB | Three libraries, one way of dropping
        Na__LePanelScrap__Register();                                          // <-- Standard: ready-made items from the config; shown only on a sheet that has some
        Na__LePanelParam__RegisterLibrary();                                   // <-- Parametric: dynamic elements - the scale bar - that keep answering to their parameters
        Na__LePanelScrapCustom__Register();                                    // <-- Custom: items saved from a selection, one JSON file each in the user content folder
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
        Na__LeMarginGrip__Attach({ editable : Na__LeMode__IsEditable() });
    }
    function Na__LeMode__DetachSheetInput() {
        if (Na__LeVw__IsViewerMode()) return;
        Na__LeMarginGrip__Detach();
        Na__LeTools__Detach();
        Na__LeTouch__Detach();
        Na__LePc__Detach();
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
            if (!Na__LeVw__IsViewerMode()) Na__LeSpecEd__Hide();                 // <-- Back from the specification: the sheet was kept underneath
            Na__LeMode__View = Na__LeMode__VIEW_SHEET;                           // <-- In the viewer, ShowDrawing puts the specification away below
            Na__LeMode__AttachSheetInput();
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
            Na__DrawView__Transitions__SuspendThreeD();                     // <-- Orbit and distance culling let go, as in a drawing
            Na__LeSnap__ResetFingerprints();                                // <-- One model walk per session, not per refresh
            Na__LeMode__AttachSheetInput();                                // <-- Pointer, keys, tools and the margin grip
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
        void Na__LeVeil__FirstOpen(Na__LeMode__Host, {
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
        Na__LeSurface__SetSheet(sheet);
        Na__LePanels__Refresh();
        if (Na__LeVw__IsViewerMode()) Na__LeVw__ShowDrawing(sheet);
        window.requestAnimationFrame(() => { if (Na__LeMode__Active) Na__LeNav__Fit(); });   // <-- Stage has a size once shown
        Na__LeMode__Dispatch();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Editor and Give the 3D View Back
    // ------------------------------------------------------------
    function Na__LeMode__Leave() {
        Na__LeRegEd__Hide();
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
        if (Na__LeVw__IsViewerMode()) Na__LeVw__ShowRegister();
        Na__LeMode__View = Na__LeMode__VIEW_REGISTER;
        Na__LeRegEd__Show();
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
        return null;                                                            // <-- Viewports and structural changes: everything may have moved
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Section That Edits a Kind of Sheet Item
    // ------------------------------------------------------------
    // The selection side of PanelFor, which answers the same question for a
    // change announcement. A kind with no section of its own - a viewport, a
    // group - answers null and the folds are left alone.
    // ------------------------------------------------------------
    function Na__LeMode__SectionForKind(kind) {
        if (kind === 'annotation') return 'text';
        if (kind === 'dimension')  return 'dimensions';
        if (kind === 'shape')      return 'shapes';
        if (kind === 'leader')     return 'leaders';
        return null;
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
    function Na__LeMode__FocusPanelFor(kind) {
        if (!Na__LeMode__Active || !Na__LeCfg__GetPanelSetup().focusOnSelect) return false;
        const section = Na__LeMode__SectionForKind(kind);
        return section ? Na__LePanels__FocusSection(section) : false;
    }
    function Na__LeMode__FocusPanelForSelection() {
        const items = Na__LeModel__GetSelectionItems();
        if (!items.length) return false;                                        // <-- Nothing selected: the folds are the user's again
        const kinds = new Set(Na__LeGroup__Expand(Na__LeModel__GetActiveSheet(), items).map((item) => item.kind));
        kinds.delete('group');
        if (kinds.size !== 1) return false;                                     // <-- Mixed: no one panel describes it
        return Na__LeMode__FocusPanelFor(kinds.values().next().value);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Route a Model Change to the Right Refresh
    // ------------------------------------------------------------
    function Na__LeMode__OnSheetsChanged(event) {
        if (!Na__LeMode__Active) return;
        const reason = event.detail ? event.detail.reason : 'all';
        const active = Na__LeModel__GetActiveSheet();
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
        Na__LeMode__ReadyOnce = Promise.all([ Na__LeCfg__Ready(), Na__LeEdge__Ready(), Na__LeComposite__Ready(), Na__LeGrad__Ready(), Na__LeDash__Ready(), Na__DrawCfg__Load() ]).then(() => {
            if (!Na__LeCfg__IsEnabled()) return false;
            Na__LeVw__Initialize({ editable : Na__LeMode__IsEditable(), showToast : context.showToast || null });   // <-- Asked before anything is built: the shell it gets depends on the answer
            Na__LeModel__Initialize();
            Na__LeHist__Initialize();                                        // <-- Undo and redo listen to the model from the start
            Na__LeAuto__Initialize({ showToast : context.showToast || null, editable : Na__LeMode__IsEditable() });   // <-- Browser draft and structural auto save
            const registerOptions = { editable : Na__LeMode__IsEditable(), showToast : context.showToast || null };
            Na__LeReg__Initialize(registerOptions);
            Na__LeRegEdit__Initialize(registerOptions);
            Na__LeSpec__Initialize({ showToast : context.showToast || null, editable : Na__LeMode__IsEditable() });   // <-- The project specification: nothing is read until the editor opens
            Na__LeSpecLink__Initialize();                                    // <-- Bubble codes follow their notes
            Na__LeSnap__Initialize(context);
            Na__LeSource__Initialize();                                      // <-- How many design phases stay loaded off-scene
            Na__LeViewId__Initialize();                                      // <-- Unnamed elevation viewports are named from their model and the project's north
            window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeMode__OnSheetsChanged);
            document.addEventListener('keydown', Na__LeMode__OnSaveKey, true);   // <-- Ctrl+S on the sheet, the specification and the register alike; capture, so it is answered before the browser is told

            window.addEventListener(Na__LeTools__DEFAULTS_EVENT, (event) => { if (Na__LeMode__Active) Na__LePanels__Refresh(Na__LeMode__PanelFor(event.detail && event.detail.kind)); });   // <-- A palette sync: the panel showing the new-object settings redraws
            window.addEventListener(Na__LeDrop__CHANGED_EVENT, (event) => {     // <-- Picking a style says what is being matched, the same way a selection does
                if (event.detail && event.detail.hasSource) Na__LeMode__FocusPanelFor(event.detail.kind);
            });
            window.addEventListener(Na__LePanelViewport__EDIT_EVENT, Na__LeMode__OnRequestDrawing);
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
        Na__LeMode__Initialize,
        Na__LeMode__Ready,
        Na__LeMode__Enter,
        Na__LeMode__Leave,
        Na__LeMode__OpenSpecification,
        Na__LeMode__OpenRegister,
        Na__LeMode__IsActive,
        Na__LeMode__IsEditable,
        Na__LeMode__GetView
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
