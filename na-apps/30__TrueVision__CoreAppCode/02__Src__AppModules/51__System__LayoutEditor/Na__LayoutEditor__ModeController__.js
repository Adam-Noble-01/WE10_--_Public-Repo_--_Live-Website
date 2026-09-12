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
    import { Na__LeCfg__SetAppConfig, Na__LeCfg__Ready, Na__LeCfg__IsEnabled, Na__LeCfg__IsReadOnlyOnWeb, Na__LeCfg__GetLabel } from './Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__Initialize,
        Na__LeModel__GetSheets,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__SetActiveSheetId
    } from './Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__Mount, Na__LeSurface__SetSheet, Na__LeSurface__Refresh, Na__LeSurface__SetZoom, Na__LeSurface__GetZoom } from './Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeNav__Fit } from './Na__LayoutEditor__Navigation__.js';
    import { Na__LePc__Attach, Na__LePc__Detach } from './Na__LayoutEditor__Controls__Pc__.js';
    import { Na__LeTouch__Attach, Na__LeTouch__Detach } from './Na__LayoutEditor__Controls__TouchScreen__.js';
    import { Na__LeTools__Attach, Na__LeTools__Detach } from './Na__LayoutEditor__SheetTools__.js';
    import { Na__LePanels__Mount, Na__LePanels__Refresh } from './Na__LayoutEditor__PanelHost__.js';
    import { Na__LePanelLayers__Register } from './Na__LayoutEditor__Panel__Layers__.js';
    import { Na__LePanelSheet__Register } from './Na__LayoutEditor__Panel__Sheet__.js';
    import { Na__LePanelViewport__EDIT_EVENT, Na__LePanelViewport__Register } from './Na__LayoutEditor__Panel__ViewportSettings__.js';
    import { Na__LePanelText__Register } from './Na__LayoutEditor__Panel__Text__.js';
    import { Na__LePanelDims__Register } from './Na__LayoutEditor__Panel__Dimensions__.js';
    import { Na__LePanelShapes__Register } from './Na__LayoutEditor__Panel__Shapes__.js';
    import { Na__LePanelStyles__Register } from './Na__LayoutEditor__Panel__Styles__.js';
    import { Na__LePanelModelLayers__Register } from './Na__LayoutEditor__Panel__ModelLayers__.js';
    import { Na__LeToolbar__Mount } from './Na__LayoutEditor__Toolbar__.js';
    import { Na__LeSnap__Initialize, Na__LeSnap__ResetFingerprints } from './Na__LayoutEditor__SnapshotRenderer__.js';
    import { Na__LeOsnap__Clear } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeHist__Initialize, Na__LeHist__Track } from './Na__LayoutEditor__History__.js';
    import { Na__LeAuto__Initialize } from './Na__LayoutEditor__AutoSave__.js';
    import { Na__LeRaster__CHANGED_EVENT } from './Na__LayoutEditor__RasterQuality__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Modes, Render Loop, Projection Events, Localhost
    // ------------------------------------------------------------
    import { Na__FloorPlanMode__IsEngaged, Na__FloorPlanMode__ExitPlan, Na__FloorPlanMode__EnterPlan, Na__FloorPlanMode__SetEditMode } from '../42__System__FloorPlanViews/Na__FloorPlan__ModeController__.js';
    import { Na__ElevationMode__IsEngaged, Na__ElevationMode__ExitElevation, Na__ElevationMode__EnterElevation, Na__ElevationMode__SetEditMode } from '../45__System__ElevationViews/Na__Elevation__ModeController__.js';
    import { Na__RenderLoop__RequestRender, Na__RenderLoop__Pause, Na__RenderLoop__Resume } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import { Na__DrawView__Transitions__SuspendThreeD, Na__DrawView__Transitions__ResumeThreeD } from '../40__System__DrawingViewCore/Na__DrawView__Transitions__.js';
    import { Na__PlPipe__CHANGED_EVENT, Na__PlPipe__STATUS_READY } from '../50__System__ProjectedLinework/Na__ProjectedLinework__Pipeline__.js';
    import { Na__DevGate__IsAuthoringEnabled } from '../03__AppUtils/Na__AppUtils__DevGate__.js';
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
    // ------------------------------------------------------------

    // MODULE VARIABLES | Context, Shell and State
    // ------------------------------------------------------------
    let Na__LeMode__Context   = null;
    let Na__LeMode__ReadyOnce = null;
    let Na__LeMode__Host      = null;
    let Na__LeMode__Stage     = null;
    let Na__LeMode__Active    = false;
    let Na__LeMode__Built     = false;
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
        const toast    = Na__LeMode__Context ? Na__LeMode__Context.showToast : null;

        let host = document.getElementById(Na__LeMode__HOST_ID);
        if (!host) { host = document.createElement('div'); host.id = Na__LeMode__HOST_ID; document.body.appendChild(host); }
        host.className = 'na-le-host';
        host.hidden = true;
        host.innerHTML = '<div class="na-le-shell"><div class="na-le-column na-le-column--left"></div><div class="na-le-centre"><div class="na-le-centre__toolbar"></div><div class="na-le-stage" tabindex="0"></div></div><div class="na-le-column na-le-column--right"></div></div>';
        Na__LeMode__Host  = host;
        Na__LeMode__Stage = host.querySelector('.na-le-stage');

        Na__LeSurface__Mount(Na__LeMode__Stage, { editable : editable });
        Na__LePanels__Mount({ left : host.querySelector('.na-le-column--left'), right : host.querySelector('.na-le-column--right'), editable : editable, showToast : toast });
        // LEFT COLUMN | Sheet, then the three things a drawing is made of:
        // its own layers, the render composites that make its picture, and the
        // model categories that picture is allowed to see. Left to right is
        // now "what is on the paper" against "what the selection's properties
        // are", instead of layers on one side and everything else on the other.
        Na__LePanelSheet__Register();
        Na__LePanelLayers__Register();
        Na__LePanelStyles__Register();
        Na__LePanelModelLayers__Register();
        // RIGHT COLUMN | The selected item's properties
        Na__LePanelViewport__Register();
        Na__LePanelText__Register();
        Na__LePanelDims__Register();
        Na__LePanelShapes__Register();
        Na__LeToolbar__Mount(host.querySelector('.na-le-centre__toolbar'), { editable : editable, showToast : toast });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Announce
    // ------------------------------------------------------------
    function Na__LeMode__Dispatch() {
        const sheet = Na__LeModel__GetActiveSheet();
        window.dispatchEvent(new CustomEvent(Na__LeMode__CHANGED_EVENT, { detail : { isActive : Na__LeMode__Active, sheetId : sheet ? sheet.Sheet__Id : null } }));
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
        const sheets = Na__LeModel__GetSheets();
        const sheet  = (sheetId && Na__LeModel__GetSheetById(sheetId)) || sheets[0] || null;
        if (!sheet) return false;
        Na__LeMode__Build();

        if (!Na__LeMode__Active) {
            if (Na__FloorPlanMode__IsEngaged())  Na__FloorPlanMode__ExitPlan(null);          // <-- The editor starts from the 3D view
            if (Na__ElevationMode__IsEngaged())  Na__ElevationMode__ExitElevation(null);
            Na__LeMode__CloseModelMenus();                                     // <-- The menus belong to the 3D Model tab
            document.body.classList.add(Na__LeMode__BODY_CLASS);
            const canvas = document.getElementById(Na__LeMode__CANVAS_ID);
            if (canvas) canvas.style.visibility = 'hidden';                     // <-- Alive for offscreen snapshots
            Na__LeMode__Host.hidden = false;
            Na__LeMode__Active = true;
            Na__RenderLoop__Pause(Na__LeMode__RENDER_HOLD);                  // <-- Engine idle: the sheet owns the screen; snapshots render offscreen on demand
            Na__DrawView__Transitions__SuspendThreeD();                     // <-- Orbit and distance culling let go, as in a drawing
            Na__LeSnap__ResetFingerprints();                                // <-- One model walk per session, not per refresh
            Na__LePc__Attach();                                            // <-- Mouse, wheel and keyboard, before the tools
            Na__LeTouch__Attach();                                         // <-- Touch, before the tools
            Na__LeTools__Attach({ editable : Na__LeMode__IsEditable() });
        }
        Na__LeModel__SetActiveSheetId(sheet.Sheet__Id);
        Na__LeHist__Track(sheet);                                          // <-- Undo baseline for this sheet
        Na__LeSurface__SetSheet(sheet);
        Na__LePanels__Refresh();
        window.requestAnimationFrame(() => { if (Na__LeMode__Active) Na__LeNav__Fit(); });   // <-- Stage has a size once shown
        Na__LeMode__Dispatch();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Close the Editor and Give the 3D View Back
    // ------------------------------------------------------------
    function Na__LeMode__Leave() {
        if (!Na__LeMode__Active) return false;
        Na__LeTools__Detach();
        Na__LeTouch__Detach();
        Na__LePc__Detach();
        Na__LeSurface__SetSheet(null);
        Na__LeOsnap__Clear();
        Na__LeModel__SetActiveSheetId(null);
        Na__LeMode__Host.hidden = true;
        document.body.classList.remove(Na__LeMode__BODY_CLASS);
        const canvas = document.getElementById(Na__LeMode__CANVAS_ID);
        if (canvas) canvas.style.visibility = '';
        Na__LeMode__Active = false;
        Na__DrawView__Transitions__ResumeThreeD();                          // <-- Orbit and culling back before the first 3D frame
        Na__RenderLoop__Resume(Na__LeMode__RENDER_HOLD);                    // <-- Engine runs again; one frame paints now
        Na__RenderLoop__RequestRender();
        Na__LeMode__Dispatch();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | State
    // ------------------------------------------------------------
    function Na__LeMode__IsActive() { return Na__LeMode__Active; }
    function Na__LeMode__Ready()    { return Na__LeMode__ReadyOnce || Promise.resolve(false); }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Model and Request Handling
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Route a Model Change to the Right Refresh
    // ------------------------------------------------------------
    function Na__LeMode__OnSheetsChanged(event) {
        if (!Na__LeMode__Active) return;
        const reason = event.detail ? event.detail.reason : 'all';
        const active = Na__LeModel__GetActiveSheet();
        if (reason === 'loaded' || reason === 'sheet-deleted') {
            if (!active) { const first = Na__LeModel__GetSheets()[0]; if (first) Na__LeMode__Enter(first.Sheet__Id); else Na__LeMode__Leave(); return; }
            Na__LeSurface__SetSheet(active);
        } else if (reason === 'sheet-updated' || reason === 'fields') Na__LeSurface__Refresh(reason === 'fields' ? 'chrome' : 'sheet');
        else if (reason === 'viewports' || reason === 'viewport') Na__LeSurface__Refresh('frames');
        else if (reason === 'annotations' || reason === 'annotation' || reason === 'dimensions' || reason === 'dimension') Na__LeSurface__Refresh('markup');
        else if (reason === 'layers') Na__LeSurface__Refresh('all');
        else if (reason === 'selection') { Na__LeSurface__Refresh('markup'); Na__LeSurface__Refresh('selection'); }
        else if (reason === 'active') { if (active) Na__LeSurface__SetSheet(active); }
        Na__LePanels__Refresh();
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
        Na__LeMode__ReadyOnce = Na__LeCfg__Ready().then(() => {
            if (!Na__LeCfg__IsEnabled()) return false;
            Na__LeModel__Initialize();
            Na__LeHist__Initialize();                                        // <-- Undo and redo listen to the model from the start
            Na__LeAuto__Initialize({ showToast : context.showToast || null, editable : Na__LeMode__IsEditable() });   // <-- Browser draft and structural auto save
            Na__LeSnap__Initialize(context);
            window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeMode__OnSheetsChanged);
            window.addEventListener(Na__LePanelViewport__EDIT_EVENT, Na__LeMode__OnRequestDrawing);
            window.addEventListener(Na__PlPipe__CHANGED_EVENT, (event) => {
                if (!Na__LeMode__Active) return;
                const detail = event.detail || {};
                if (detail.status && detail.status !== Na__PlPipe__STATUS_READY) return;   // <-- Only finished linework repaints the frames
                Na__LeSurface__Refresh('frames');
            });
            window.addEventListener('resize', () => { if (Na__LeMode__Active) Na__LeSurface__SetZoom(Na__LeSurface__GetZoom()); });
            window.addEventListener(Na__LeRaster__CHANGED_EVENT, () => { if (Na__LeMode__Active) Na__LeSurface__Refresh('frames'); });   // <-- A new working level re-renders the pictures
            console.log('[TrueVision3D] Layout Editor ready (' + (Na__LeMode__IsEditable() ? 'editable' : Na__LeCfg__GetLabel('ReadOnlyNote', 'read-only')) + ').');
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
        Na__LeMode__Initialize,
        Na__LeMode__Ready,
        Na__LeMode__Enter,
        Na__LeMode__Leave,
        Na__LeMode__IsActive,
        Na__LeMode__IsEditable
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
