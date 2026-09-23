// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: PARAMETRIC SCRAPBOOK
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__ScrapbookParametric__.js
// NAMESPACE  : Na__LePanelParam
// MODULE     : Layout Editor - Panel Parametric Scrapbook
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Parametric Scrapbook's two panel sections - the library of elements to drag in, and the settings of the one that is selected - and the subsystem's one entry point
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - THE LIBRARY, on the right column's Scrapbook tab: one tile per
//   element the config offers on the active sheet's drawing type. A tile is
//   dragged onto the paper or double-clicked, exactly like every other
//   scrapbook tile (Na__LayoutEditor__Scrapbook__TileDrag__). The element
//   lands linked to the viewport nearest the drop and at that viewport's
//   scale.
// - THE SETTINGS, first on the right column's Properties tab, shown only while one
//   parametric element is selected: the viewport it is linked to, its scale,
//   its divisions, the split of its first division and its units. They are
//   the same choices the lookup grip's menu offers, laid out to be read.
//   Picking a scale by hand lets go of the viewport; picking a viewport
//   takes its scale.
// - THE ENTRY POINT. Whichever of the two Register functions the mode
//   controller calls first does the subsystem's wiring, once: it registers
//   the element types with the engine, starts the viewport follower and hands
//   the grips to the grips module. The mode controller is the only module
//   outside this folder that imports from it, bar the Custom Scrapbook, which
//   asks the engine to make a saved group portable.
//
// INTEGRATION:
// - Na__LayoutEditor__ModeController__ calls RegisterProperties before the
//   Viewport section (so it sits first on the Properties tab) and
//   RegisterLibrary after the Standard Scrapbook's, on the Scrapbook tab.
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__Grips__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__LinkNoodle__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__CabinetInfill__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.2.0 ported 20-Sep-2026 as ValeVision3D v2.68.0, verbatim
// - Ahead of it   : 1.3.0 (the storey hint), 1.4.0 (where a title's bar
//                   sits), 1.5.0 (the refit once the text metrics land) and
//                   1.6.0 (the cabinet infill) are TrueVision only. ValeVision holds 1.2.0, its floor
//                   plans have no storey field and its bar is always below.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.7.0
// - A tile whose type is held by a base point - the cabinet infill's bottom
//   left corner - hangs from that point while it is dragged in, snaps it to
//   the drawing (the tile drag's hold and snap), and lands with it on the
//   drop (the engine's Insert at 'base'), not centred there.
//
// 21-Sep-2026 - Version 1.6.0
// - The Cabinet Infill: registered with the others, and a block of its own
//   in the settings - what it reads, the listed words and words of one's
//   own, which way they run, the fill underneath and its colour, the size
//   on the paper and on the drawing, the text size. The tools hand a type
//   the Text setup's line spacing. An element may give its size in real
//   millimetres (Element__RealSizeMm): a tile dropped on a drawing is then
//   sized at that drawing's scale.
//
// 21-Sep-2026 - Version 1.5.0
// - The tools say whether the text measure is yet the paper's own
//   (metricsReady), and the wiring waits for jsPDF and the Open Sans cuts,
//   then books a refresh of the sheet on screen - which now refits any title
//   whose underline was drawn to the chrome's estimate before they loaded.
//   A load that fails is asked for again the next time a sheet comes up.
//
// 20-Sep-2026 - Version 1.4.0
// - Where a title's scale bar sits, and how far along it stands when it sits
//   to the right: two more of a title's own controls, the second shown only
//   for the first's second answer, stepping by whatever the config says.
//
// 20-Sep-2026 - Version 1.3.0
// - A title's one sentence of explanation asks the sentence where its subject
//   came from (Compose's source) where it used to look at ViewName: a typed
//   viewport name that gives way to the plan's storey is no longer reported
//   as the name in use. A title written from a storey says where that is set.
//
// 20-Sep-2026 - Version 1.2.0
// - The Drawing Title: registered beside the scale bar, with the viewport
//   identity module's words and the chrome's text measure handed to the
//   engine as a tool. Tiles are ELEMENTS now, not types - two may share a
//   type - so a tile is keyed by its element's id, drawn with its preview
//   parameters and dropped with its preset ones. The settings section shows
//   a title's controls for a title, a bar's for anything that has a bar, and
//   says in words why a title still holds a {{placeholder}}.
//
// 19-Sep-2026 - Version 1.1.0
// - The library moves to the right column's Scrapbook tab. Linked to offers
//   the sheet's own scale as well as the viewports, and the link noodle is
//   attached with the grips.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Scale Labels, the Tile Drag, the Panel Host and the Subsystem
    // ------------------------------------------------------------
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet, Na__LeModel__GetSelection } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeDrawScale__Label } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeScrap__TAB_ID } from '../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__.js';
    import { Na__LeScrapDrag__Tile, Na__LeScrapDrag__EndDrag } from '../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__TileDrag__.js';
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__SetSectionVisible,
        Na__LePanels__Refresh,
        Na__LePanels__OnControl,
        Na__LePanels__IsEditable,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__FillSelect,
        Na__LePanels__Button,
        Na__LePanels__Note
    } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeParam__STATUS_FAILED,
        Na__LeParam__Ready,
        Na__LeParam__GetStatus,
        Na__LeParam__Block,
        Na__LeParam__Label,
        Na__LeParam__RegisterType,
        Na__LeParam__GetType,
        Na__LeParam__IsLinkable,
        Na__LeParam__SetTools,
        Na__LeParam__ElementsFor,
        Na__LeParam__ElementName,
        Na__LeParam__ElementId,
        Na__LeParam__ElementParams,
        Na__LeParam__ElementPreviewParams,
        Na__LeParam__TypeName,
        Na__LeParam__GetBlockById,
        Na__LeParam__GetParams,
        Na__LeParam__IsLocked,
        Na__LeParam__AnchorOf,
        Na__LeParam__BuildSet,
        Na__LeParam__BasePoint,
        Na__LeParam__Insert,
        Na__LeParam__Regenerate,
        Na__LeParam__ResetToStandard
    } from './Na__LayoutEditor__ScrapbookParametric__.js';
    import { Na__LeParamBar__CreateType } from './Na__LayoutEditor__ScrapbookParametric__ScaleBar__.js';
    import {
        Na__LeParamTitle__TYPE,
        Na__LeParamTitle__PLACE_BELOW,
        Na__LeParamTitle__PLACE_RIGHT,
        Na__LeParamTitle__CreateType
    } from './Na__LayoutEditor__ScrapbookParametric__DrawingTitle__.js';
    import {
        Na__LeParamArea__TYPE,
        Na__LeParamArea__FORM_AREAS,
        Na__LeParamArea__FORM_GROUPS,
        Na__LeParamArea__FORM_PROJECT,
        Na__LeParamArea__CreateType
    } from './Na__LayoutEditor__ScrapbookParametric__AreaSchedule__.js';
    import {
        Na__LeParamQr__TYPE,
        Na__LeParamQr__FORM_COMPACT,
        Na__LeParamQr__FORM_FULL,
        Na__LeParamQr__NAME_MISSING,
        Na__LeParamQr__CreateType
    } from './Na__LayoutEditor__ScrapbookParametric__ProjectQr__.js';
    import {
        Na__LeParamInfill__TYPE,
        Na__LeParamInfill__RUN_AUTO,
        Na__LeParamInfill__RUN_ACROSS,
        Na__LeParamInfill__RUN_UP,
        Na__LeParamInfill__CreateType
    } from './Na__LayoutEditor__ScrapbookParametric__CabinetInfill__.js';
    import { Na__QrLink__CurrentProject } from '../53__Feature__ProjectQrCode/Na__ProjectQr__ProjectLink__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__CfApi__GetLoadedProjectData } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import { Na__LeViewId__Ready, Na__LeViewId__Words, Na__LeViewId__IsNorthSet } from '../20__System__Viewports/Na__LayoutEditor__ViewportIdentity__.js';
    import {
        Na__LeViewText__MODE_AUTO,
        Na__LeViewText__MODE_EXISTING,
        Na__LeViewText__MODE_PROPOSED,
        Na__LeViewText__MODE_NONE,
        Na__LeViewText__MISSING_DIRECTION,
        Na__LeViewText__MISSING_DRAWING,
        Na__LeViewText__SOURCE_NAME,
        Na__LeViewText__SOURCE_LEVEL
    } from '../20__System__Viewports/Na__LayoutEditor__ViewportTitleText__.js';
    import { Na__LeChrome__MeasureTextMm } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeCfg__GetTextSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';   // <-- The line height sheet text is drawn at, which a broken label's box is built to
    import { Na__LePdf__EnsureJsPdf } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfExporter__.js';   // <-- The library the chrome measures text with
    import { Na__LePdfFonts__EnsureLoaded } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfFonts__.js';   // <-- And the Open Sans cuts it measures them in
    import {
        Na__LeParamLink__KIND_VIEWPORT,
        Na__LeParamLink__KIND_SHEET,
        Na__LeParamLink__Attach,
        Na__LeParamLink__BookRefresh,
        Na__LeParamLink__Candidates,
        Na__LeParamLink__Nearest,
        Na__LeParamLink__ViewportName,
        Na__LeParamLink__DescribeById,
        Na__LeParamLink__SetLink,
        Na__LeParamLink__SetSheetLink,
        Na__LeParamLink__InsertLinked
    } from './Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js';
    import { Na__LeDrawScale__SheetDenominator } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeParamGrips__Attach } from './Na__LayoutEditor__ScrapbookParametric__Grips__.js';
    import { Na__LeParamNoodle__Attach } from './Na__LayoutEditor__ScrapbookParametric__LinkNoodle__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Sections, Controls and the Changes Each Section Answers To
    // ------------------------------------------------------------
    const Na__LePanelParam__LIBRARY_ID    = 'scrapbook-parametric';
    const Na__LePanelParam__PROPS_ID      = 'parametric-element';
    const Na__LePanelParam__NO_LINK       = '';
    const Na__LePanelParam__SHEET_LINK    = '@sheet';                           // <-- Never a viewport id: those are Viewport_nnn
    const Na__LePanelParam__BAR_CONTROLS   = Object.freeze([ 'param-scale', 'param-divisions', 'param-subdivide', 'param-subdivision', 'param-units', 'param-reset' ]);
    const Na__LePanelParam__TITLE_CONTROLS = Object.freeze([ 'param-title-text', 'param-title-phase', 'param-title-upper', 'param-title-underline', 'param-title-bar', 'param-title-bar-place', 'param-title-bar-offset' ]);
    const Na__LePanelParam__QR_CONTROLS    = Object.freeze([ 'param-qr-size', 'param-qr-form', 'param-qr-width', 'param-qr-project' ]);
    const Na__LePanelParam__AREA_CONTROLS  = Object.freeze([ 'param-area-form', 'param-area-group', 'param-area-width', 'param-area-text', 'param-area-units', 'param-area-decimals', 'param-area-headings', 'param-area-total', 'param-area-swatch', 'param-area-title', 'param-area-suffix' ]);
    const Na__LePanelParam__INFILL_CONTROLS = Object.freeze([ 'param-infill-label', 'param-infill-text', 'param-infill-run', 'param-infill-fill', 'param-infill-fill-colour', 'param-infill-width', 'param-infill-height', 'param-infill-size' ]);
    const Na__LePanelParam__LIBRARY_SHOWS = Object.freeze([ 'active', 'loaded', 'sheet-created', 'sheet-deleted', 'sheet-updated' ]);   // <-- What can alter which sheet, or which drawing type, is up
    const Na__LePanelParam__PROPS_SHOWS   = Object.freeze([ 'selection', 'active', 'loaded', 'sheet-deleted', 'sheet-updated', 'groups', 'shape', 'shapes', 'annotation', 'annotations', 'viewport', 'viewports', 'layers' ]);   // <-- What can alter the selected element, its link or its lock
    // ------------------------------------------------------------

    // MODULE VARIABLES | Tiles, Listening and the Stylesheet
    // ------------------------------------------------------------
    let Na__LePanelParam__Signature = null;     // <-- What the tiles were last built for, so a refresh per model change rebuilds nothing
    let Na__LePanelParam__Wired     = false;
    let Na__LePanelParam__MetricsReady = false; // <-- jsPDF and the Open Sans cuts are in: the chrome's text measure is the paper's own
    let Na__LePanelParam__MetricsAsked = false; // <-- They have been asked for and not failed
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Subsystem's Wiring
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What the Project on Screen Is Called
    // ------------------------------------------------------------
    // The PWA's own project context first - "Musters Road" - which is what
    // the Project Specification and the Drawing Register both print, so three
    // documents in one pack can never call the project three things. Then the
    // project data's own name, then nothing.
    //
    // THE CODE IS PUT IN FRONT OF IT - PS01 - Musters Road - because that code
    // is what the QR symbol beside it carries and what every drawing number in
    // the pack begins with. A name that already starts with its code is left
    // alone, and a project with a code and no name is its code.
    //
    // Empty when nothing is known yet. The type shows {{Project}} then, and
    // the next rebuild fills it in - never a guess at what the project might
    // be called.
    // ------------------------------------------------------------
    function Na__LePanelParam__ProjectName() {
        const context = window.TrueVision__Pwa__ProjectContext;
        const active  = (context && typeof context.get === 'function') ? context.get() : null;
        const loaded  = Na__CfApi__GetLoadedProjectData() || {};
        const named   = String((active && (active.displayName || active.shortName)) || loaded.Project__Name || '').trim();
        const code    = String(Na__QrLink__CurrentProject().projectCode || Na__DrawData__GetProjectCode() || '').trim();
        if (named === '') return code;
        if (code === '' || named.toUpperCase().indexOf(code.toUpperCase()) === 0) return named;
        return code + ' - ' + named;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Two Form Names, as the Config Words Them
    // ------------------------------------------------------------
    // Handed to the Project Portal type so its lookup menu is worded from the
    // config like everything else, without the type - which is pure - having
    // to read a file.
    // ------------------------------------------------------------
    function Na__LePanelParam__QrMenuWords() {
        return {
            compact : Na__LeParam__Label('MenuQrCompact', 'Code and list'),
            full    : Na__LeParam__Label('MenuQrFull', 'With the full description')
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Area Schedule's Menu Words, as the Config Words Them
    // ------------------------------------------------------------
    // Handed to the schedule type so its lookup menu is worded from the config
    // like everything else, without the type - which is pure - reading a file.
    // ------------------------------------------------------------
    function Na__LePanelParam__AreaMenuWords() {
        const L = Na__LeParam__Label;
        return {
            formAreas     : L('MenuAreaFormAreas', 'Every area, by group'),
            formGroups    : L('MenuAreaFormGroups', 'Totals by group'),
            formProject   : L('MenuAreaFormProject', 'Totals by group, whole project'),
            noSuffix      : L('MenuAreaNoSuffix', 'No floor in the title'),
            allGroups     : L('MenuAreaAllGroups', 'Every group'),
            onlyGroup     : L('MenuAreaOnlyGroup', 'Only {group}'),
            groupHeadings : L('MenuAreaHeadings', 'Group headings and subtotals'),
            total         : L('MenuAreaTotal', 'Total row'),
            swatch        : L('MenuAreaSwatch', 'Colour chips'),
            unitsM2       : L('MenuAreaUnitsM2', 'Square metres'),
            unitsFt2      : L('MenuAreaUnitsFt2', 'Square feet'),
            unitsBoth     : L('MenuAreaUnitsBoth', 'Both, feet in brackets')
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Cabinet Infill's Menu Words, as the Config Words Them
    // ------------------------------------------------------------
    // The listed words are the config's own list and need no wording; these
    // are the fill and the three ways the words can run.
    // ------------------------------------------------------------
    function Na__LePanelParam__InfillMenuWords() {
        const L = Na__LeParam__Label;
        return {
            fill   : L('MenuInfillFill', 'White fill underneath'),
            auto   : L('MenuInfillAuto', 'Words along the longer side'),
            across : L('MenuInfillAcross', 'Words across'),
            up     : L('MenuInfillUp', 'Words up the sheet')
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wait for the Paper's Own Text Metrics, Then Refit the Sheet on Screen
    // ------------------------------------------------------------
    // The chrome measures text through jsPDF and the Open Sans cuts, and
    // until both are in it answers an average-width estimate - ten per cent
    // short on a line of capitals. The mode controller asks for them on the
    // first drawing tab of a session, but the sheet's first refresh runs
    // straight away, so a title rebuilt by it is drawn to the estimate. The
    // moment they land the sheet on screen is refreshed, which refits any
    // such title; every sheet after it is refit as it comes up.
    //
    // OPEN SANS THAT FAILS TO LOAD LEAVES THE FLAG DOWN. The measure then
    // falls back to Helvetica, which is not the type on screen, and fitting
    // to it would fight the next machine that has the font. A load that
    // throws is asked for again when the next sheet comes up.
    // ------------------------------------------------------------
    function Na__LePanelParam__AwaitMetrics() {
        if (Na__LePanelParam__MetricsReady || Na__LePanelParam__MetricsAsked) return;
        Na__LePanelParam__MetricsAsked = true;
        Na__LePdf__EnsureJsPdf()
            .then(() => Na__LePdfFonts__EnsureLoaded())
            .then((loaded) => {
                Na__LePanelParam__MetricsReady = loaded === true;
                if (Na__LePanelParam__MetricsReady) Na__LeParamLink__BookRefresh();   // <-- Editable sheets only, after the present announcement: the link module's own rules
            })
            .catch(() => { Na__LePanelParam__MetricsAsked = false; });            // <-- Estimates meanwhile, and nothing refit to them
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Register the Types, Start the Follower, Hand Over the Grips (once)
    // ------------------------------------------------------------
    // A type is registered with a reader for its config block rather than the
    // block itself, so it draws from the config whenever that arrives. The
    // stylesheet is this folder's own and is linked from here, as the Drawing
    // Register links its own.
    // ------------------------------------------------------------
    function Na__LePanelParam__Wire() {
        if (Na__LePanelParam__Wired) return;
        Na__LePanelParam__Wired = true;
        const link = document.createElement('link');
        link.rel  = 'stylesheet';
        link.href = new URL('./Na__LayoutEditor__Styles__ScrapbookParametric__.css', import.meta.url).href;
        document.head.appendChild(link);
        Na__LeParam__RegisterType(Na__LeParamBar__CreateType(() => Na__LeParam__Block('ScaleBar')));
        Na__LeParam__RegisterType(Na__LeParamTitle__CreateType(() => Na__LeParam__Block('DrawingTitle'), () => Na__LeParam__Block('ScaleBar'), Na__LeViewId__Words));
        Na__LeParam__RegisterType(Na__LeParamQr__CreateType(() => Na__LeParam__Block('ProjectQr'), Na__LePanelParam__QrMenuWords));
        Na__LeParam__RegisterType(Na__LeParamArea__CreateType(() => Na__LeParam__Block('AreaSchedule'), Na__LePanelParam__AreaMenuWords));   // <-- The area schedule; its numbers are filled in by 59__Feature__FloorAreas
        Na__LeParam__RegisterType(Na__LeParamInfill__CreateType(() => Na__LeParam__Block('CabinetInfill'), Na__LePanelParam__InfillMenuWords));   // <-- The cabinet infill: a cross and a boxed name over a cupboard
        Na__LeParam__SetTools({                                               // <-- A type is pure; whatever it cannot reach is handed over here
            measureTextMm : (value, sizeMm, weight) => Na__LeChrome__MeasureTextMm(value, sizeMm, weight),   // <-- The chrome's own measurer, so a line breaks where it breaks on paper
            metricsReady  : () => Na__LePanelParam__MetricsReady,             // <-- Until true that measurer answers an estimate, and nothing is refit to it
            projectName   : Na__LePanelParam__ProjectName,                    // <-- Called on every build, so renaming the project rewrites the blocks that letter it
            lineSpacing   : () => Na__LeCfg__GetTextSetup().lineSpacing       // <-- How far apart the editor draws a text record's lines, which a label broken over lines is boxed to
        });
        Na__LePanelParam__AwaitMetrics();
        void Na__LeViewId__Ready();
        Na__LeParamLink__Attach();
        Na__LeParamGrips__Attach();
        Na__LeParamNoodle__Attach();                                          // <-- After the grips, so the socket is drawn over the noodle it starts
        window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LePanelParam__OnModelChanged);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Library Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Element's Preset, Sized for the Drawing It Is Dropped On
    // ------------------------------------------------------------
    // An element may give its size on the ground - Element__RealSizeMm, width
    // and height in real millimetres - for a type whose own size is a paper
    // WidthMm and HeightMm: the cabinet infill. Dropped INSIDE a scaled
    // drawing it is drawn at that drawing's scale, so a 1800 x 600 unit is
    // 36 x 12 mm on a 1:50 plan and 18 x 6 on a 1:100 one; dropped anywhere
    // else it keeps the paper size its preset and its type give it. Inside,
    // not nearest: a cupboard is drawn over its plan, not beside it. The
    // drawing is found by the link module, the one that knows what a
    // viewport is; nothing is tied to it.
    // ------------------------------------------------------------
    function Na__LePanelParam__DropParams(element, sheet, centreMm) {
        const params = Na__LeParam__ElementParams(element);
        const real   = element ? element.Element__RealSizeMm : null;
        if (!Array.isArray(real) || real.length !== 2 || !real.every((mm) => typeof mm === 'number' && Number.isFinite(mm) && mm > 0)) return params;
        const drawing = Na__LeParamLink__Nearest(sheet, centreMm, 0);
        if (!drawing) return params;
        return Object.assign(params, { WidthMm : real[0] / drawing.Viewport__ScaleDenominator, HeightMm : real[1] / drawing.Viewport__ScaleDenominator });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Element as the Tile Drag's Spec
    // ------------------------------------------------------------
    // The tile and the ghost draw the element at its type's default scale,
    // with its preview parameters. The drop is the link module's: it reads
    // the scale, and the facts a title is written from, off the nearest
    // viewport, over the element's own preset parameters.
    //
    // A TYPE HELD BY A BASE POINT IS DROPPED BY IT. The cabinet infill hangs
    // from its bottom left corner while it is dragged in (hold), that corner
    // snaps to the drawing (snap), and the engine puts it on the drop point
    // rather than centring the infill there - the way a CAD block is
    // inserted. Such a type is never tied to a drawing, so the link module
    // has nothing to add and the engine is asked directly.
    // ------------------------------------------------------------
    function Na__LePanelParam__Spec(element, editable) {
        const name = Na__LeParam__ElementName(element);
        const hint = (typeof element.Element__Description === 'string' && element.Element__Description !== '') ? element.Element__Description : '';
        const drag = Na__LeParam__Label('ItemTitle', '{name}: drag onto the sheet, or double-click to place it in the middle of the view.', { name : name });
        const held = Na__LeParam__BasePoint(element.Element__Type, Na__LeParam__ElementPreviewParams(element));   // <-- Null for every type held by its middle
        return {
            id       : 'parametric:' + Na__LeParam__ElementId(element),
            name     : name,
            title    : editable ? (hint !== '' ? hint + '\n\n' + drag : drag) : name,
            editable : editable,
            modifier : 'na-le-scrap__item--param',
            buildSet : () => Na__LeParam__BuildSet(element.Element__Type, Na__LeParam__ElementPreviewParams(element), null),
            hold     : held ? () => held : null,                          // <-- The ghost is built at (0, 0), so the base point from the origin is the point of the set
            snap     : !!held,
            place    : held
                ? (sheet, pointMm)  => Na__LeParam__Insert(sheet, element.Element__Type, pointMm, Na__LePanelParam__DropParams(element, sheet, pointMm), null, { at : 'base' })
                : (sheet, centreMm) => Na__LeParamLink__InsertLinked(sheet, element.Element__Type, centreMm, Na__LePanelParam__DropParams(element, sheet, centreMm))
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build and Reflect the Library
    // ------------------------------------------------------------
    function Na__LePanelParam__BuildLibrary(body) {
        const note = Na__LePanels__Note('');
        note.setAttribute('data-na-param', 'note');
        const grid = document.createElement('div');
        grid.className = 'na-le-scrap';
        grid.setAttribute('data-na-param', 'grid');
        body.appendChild(note);
        body.appendChild(grid);
        Na__LePanelParam__Signature = null;                                  // <-- A new body has no tiles yet
    }
    function Na__LePanelParam__RefreshLibrary(body) {
        const sheet    = Na__LeModel__GetActiveSheet();
        const status   = Na__LeParam__GetStatus();
        const editable = Na__LePanels__IsEditable();
        const elements = Na__LeParam__ElementsFor(sheet);
        const note     = body.querySelector('[data-na-param="note"]');
        const grid     = body.querySelector('[data-na-param="grid"]');
        if (note) {
            if (status === Na__LeParam__STATUS_FAILED) note.textContent = Na__LeParam__Label('LibraryFailed', 'The parametric scrapbook could not be read, so it has no elements.');
            else if (editable) note.textContent = Na__LeParam__Label('LibraryHint', 'Dynamic elements. Drag one onto the sheet, or double-click it; select it afterwards for its grips and its settings.');
            else note.textContent = Na__LeParam__Label('LibraryReadOnly', 'Elements can only be placed while sheets are editable.');
        }
        if (!grid) return;
        const signature = [ status, editable ? 'edit' : 'view' ].concat(elements.map((element) => Na__LeParam__ElementId(element))).join('|');
        if (signature === Na__LePanelParam__Signature) return;
        Na__LePanelParam__Signature = signature;
        grid.innerHTML = '';
        elements.forEach((element) => grid.appendChild(Na__LeScrapDrag__Tile(Na__LePanelParam__Spec(element, editable))));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Library Only on a Sheet That Has Elements
    // ------------------------------------------------------------
    // A config that could not be read still shows, to say so.
    // ------------------------------------------------------------
    function Na__LePanelParam__SyncLibrary() {
        const sheet = Na__LeModel__GetActiveSheet();
        const show  = !!sheet && (Na__LeParam__ElementsFor(sheet).length > 0 || Na__LeParam__GetStatus() === Na__LeParam__STATUS_FAILED);
        Na__LePanels__SetSectionVisible(Na__LePanelParam__LIBRARY_ID, show);
        if (!show) { Na__LeScrapDrag__EndDrag(); return; }
        Na__LePanels__Refresh(Na__LePanelParam__LIBRARY_ID);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Settings Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The One Selected Parametric Element, or Null
    // ------------------------------------------------------------
    // { sheet, groupId, params, type }. Several selected is none, as it is
    // for every properties panel.
    // ------------------------------------------------------------
    function Na__LePanelParam__Selected() {
        const sheet     = Na__LeModel__GetActiveSheet();
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || selection.kind !== 'group') return null;
        const block = Na__LeParam__GetBlockById(sheet, selection.id);
        if (!block) return null;
        return { sheet : sheet, groupId : selection.id, params : Na__LeParam__GetParams(sheet, selection.id), type : Na__LeParam__GetType(block.Parametric__Type) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Controls
    // ------------------------------------------------------------
    function Na__LePanelParam__BuildProps(body) {
        const L = Na__LeParam__Label;
        const name = Na__LePanels__Note('');
        name.setAttribute('data-na-param', 'name');
        name.classList.add('na-le-param__name');
        body.appendChild(name);

        const linkRow = Na__LePanels__Row(L('PropsLink', 'Linked to'), Na__LePanels__Select('param-link', [], null));
        linkRow.setAttribute('data-na-param', 'link-row');
        body.appendChild(linkRow);

        // A TITLE'S OWN | Shown for a Drawing Title and for nothing else
        const title = document.createElement('div');
        title.setAttribute('data-na-param', 'title-block');
        const reads = Na__LePanels__Note('');
        reads.setAttribute('data-na-param', 'title-reads');
        reads.classList.add('na-le-param__reads');
        title.appendChild(reads);
        const why = Na__LePanels__Note('');
        why.setAttribute('data-na-param', 'title-why');
        title.appendChild(why);
        title.appendChild(Na__LePanels__Row(L('PropsPhase', 'Existing / Proposed'), Na__LePanels__Select('param-title-phase', [], null)));
        title.appendChild(Na__LePanels__Row(L('PropsTitleText', 'Title text'), Na__LePanels__Input('text', 'param-title-text', { maxlength : 200, placeholder : L('PropsTitleAuto', 'Automatic') })));
        title.appendChild(Na__LePanels__Row(L('PropsUppercase', 'Capitals'), Na__LePanels__Input('checkbox', 'param-title-upper'), 'na-le-row--toggle'));
        title.appendChild(Na__LePanels__Row(L('PropsUnderline', 'Underline (mm)'), Na__LePanels__Input('number', 'param-title-underline', { min : 10, max : 400, step : 5 })));
        title.appendChild(Na__LePanels__Row(L('PropsShowBar', 'Scale bar'), Na__LePanels__Input('checkbox', 'param-title-bar'), 'na-le-row--toggle'));

        // WHERE THAT BAR SITS | Under the title, or away along the same line. The
        // position is the second one's only, and is hidden with it.
        const place = Na__LePanels__Row(L('PropsBarPlace', 'Bar sits'), Na__LePanels__Select('param-title-bar-place', [], null));
        place.setAttribute('data-na-param', 'bar-place');
        title.appendChild(place);
        const across = Na__LePanels__Row(L('PropsBarOffset', 'Bar position (mm)'), Na__LePanels__Input('number', 'param-title-bar-offset', { min : 0, max : 1200, step : 50 }));
        across.setAttribute('data-na-param', 'bar-offset');
        title.appendChild(across);
        const acrossNote = Na__LePanels__Note('');
        acrossNote.setAttribute('data-na-param', 'bar-offset-note');
        title.appendChild(acrossNote);
        body.appendChild(title);

        // A BAR'S OWN | Shown for a scale bar, and for a title that carries one
        const barBlock = document.createElement('div');
        barBlock.setAttribute('data-na-param', 'bar-block');
        body.appendChild(barBlock);
        barBlock.appendChild(Na__LePanels__Row(L('PropsScale', 'Scale'), Na__LePanels__Select('param-scale', [], null)));
        barBlock.appendChild(Na__LePanels__Row(L('PropsDivisions', 'Divisions'), Na__LePanels__Input('number', 'param-divisions', { min : 1, max : 40, step : 1 })));

        const length = Na__LePanels__Note('');
        length.setAttribute('data-na-param', 'length');
        barBlock.appendChild(length);

        barBlock.appendChild(Na__LePanels__Row(L('PropsSubdivide', 'Split first division'), Na__LePanels__Input('checkbox', 'param-subdivide'), 'na-le-row--toggle'));
        const into = Na__LePanels__Row(L('PropsSubdivision', 'Into'), Na__LePanels__Select('param-subdivision', [], null));
        into.setAttribute('data-na-param', 'into');
        barBlock.appendChild(into);
        barBlock.appendChild(Na__LePanels__Row(L('PropsUnits', 'Show units'), Na__LePanels__Input('checkbox', 'param-units'), 'na-le-row--toggle'));

        const bar = document.createElement('div');
        bar.className = 'na-le-bar';
        bar.appendChild(Na__LePanels__Button(L('PropsReset', 'Reset to standard'), 'param-reset', ''));
        barBlock.appendChild(bar);

        // THE PROJECT PORTAL BLOCK'S OWN | Shown for it and for nothing else.
        // There is no control for the code: it is the project's, it fills
        // itself in, and a box offering to change it would be offering
        // something that cannot be done and should not be wanted.
        const portal = document.createElement('div');
        portal.setAttribute('data-na-param', 'qr-block');
        const names = Na__LePanels__Note('');
        names.setAttribute('data-na-param', 'qr-reads');
        names.classList.add('na-le-param__reads');
        portal.appendChild(names);
        const qrWhy = Na__LePanels__Note('');
        qrWhy.setAttribute('data-na-param', 'qr-why');
        portal.appendChild(qrWhy);
        portal.appendChild(Na__LePanels__Row(L('PropsQrSize', 'Code size (mm)'), Na__LePanels__Select('param-qr-size', [], null)));
        portal.appendChild(Na__LePanels__Row(L('PropsQrForm', 'Shows'), Na__LePanels__Select('param-qr-form', [], null)));
        const width = Na__LePanels__Row(L('PropsQrWidth', 'Description width (mm)'), Na__LePanels__Input('number', 'param-qr-width', { min : 45, max : 260, step : 5 }));
        width.setAttribute('data-na-param', 'qr-width');
        portal.appendChild(width);
        const widthNote = Na__LePanels__Note('');
        widthNote.setAttribute('data-na-param', 'qr-width-note');
        portal.appendChild(widthNote);
        portal.appendChild(Na__LePanels__Row(L('PropsQrProject', 'Project name'), Na__LePanels__Input('text', 'param-qr-project', { maxlength : 80, placeholder : L('PropsQrProjectAuto', 'Automatic') })));
        const qrCode = Na__LePanels__Note(L('PropsQrCode', 'The code is this project\'s own, and is the same one the title block prints. It fills itself in - there is nothing to choose.'));
        qrCode.setAttribute('data-na-param', 'qr-code-note');
        portal.appendChild(qrCode);
        body.appendChild(portal);

        // THE AREA SCHEDULE'S OWN | Shown for a schedule and for nothing else.
        // There is no control for the numbers: they are the sheet's rooms, they
        // fill themselves in, and a box offering to type over them would be
        // offering to make the drawing and its table disagree.
        const schedule = document.createElement('div');
        schedule.setAttribute('data-na-param', 'area-block');
        const areaReads = Na__LePanels__Note('');
        areaReads.setAttribute('data-na-param', 'area-reads');
        areaReads.classList.add('na-le-param__reads');
        schedule.appendChild(areaReads);
        schedule.appendChild(Na__LePanels__Row(L('PropsAreaForm', 'Shows'), Na__LePanels__Select('param-area-form', [], null)));
        schedule.appendChild(Na__LePanels__Row(L('PropsAreaGroup', 'Only the group'), Na__LePanels__Select('param-area-group', [], null)));
        schedule.appendChild(Na__LePanels__Row(L('PropsAreaTitle', 'Title'), Na__LePanels__Input('text', 'param-area-title', { maxlength : 120, placeholder : L('PropsAreaTitleAuto', 'Automatic') })));
        schedule.appendChild(Na__LePanels__Row(L('PropsAreaSuffix', 'Floor after the title'), Na__LePanels__Select('param-area-suffix', [], null)));
        schedule.appendChild(Na__LePanels__Row(L('PropsAreaUnits', 'Units'), Na__LePanels__Select('param-area-units', [], null)));
        schedule.appendChild(Na__LePanels__Row(L('PropsAreaDecimals', 'Decimal places'), Na__LePanels__Input('number', 'param-area-decimals', { min : 0, max : 3, step : 1 })));
        schedule.appendChild(Na__LePanels__Row(L('PropsAreaWidth', 'Width (mm)'), Na__LePanels__Input('number', 'param-area-width', { min : 40, max : 260, step : 2 })));
        schedule.appendChild(Na__LePanels__Row(L('PropsAreaTextSize', 'Type size (mm)'), Na__LePanels__Input('number', 'param-area-text', { min : 0.8, max : 12, step : 0.1 })));
        const headings = Na__LePanels__Row(L('PropsAreaHeadings', 'Group headings'), Na__LePanels__Input('checkbox', 'param-area-headings'), 'na-le-row--toggle');
        headings.setAttribute('data-na-param', 'area-headings-row');
        schedule.appendChild(headings);
        schedule.appendChild(Na__LePanels__Row(L('PropsAreaTotal', 'Total row'), Na__LePanels__Input('checkbox', 'param-area-total'), 'na-le-row--toggle'));
        schedule.appendChild(Na__LePanels__Row(L('PropsAreaSwatch', 'Colour chips'), Na__LePanels__Input('checkbox', 'param-area-swatch'), 'na-le-row--toggle'));
        body.appendChild(schedule);

        // THE CABINET INFILL'S OWN | Shown for an infill and for nothing else.
        // The words first - they are why it is there - then which way they run,
        // the fill under it, its size and the size of its words.
        const infill = document.createElement('div');
        infill.setAttribute('data-na-param', 'infill-block');
        const infillReads = Na__LePanels__Note('');
        infillReads.setAttribute('data-na-param', 'infill-reads');
        infillReads.classList.add('na-le-param__reads');
        infill.appendChild(infillReads);
        infill.appendChild(Na__LePanels__Row(L('PropsInfillLabel', 'Label'), Na__LePanels__Select('param-infill-label', [], null)));
        infill.appendChild(Na__LePanels__Row(L('PropsInfillText', 'Own words'), Na__LePanels__Input('text', 'param-infill-text', { maxlength : 80 })));
        const infillWhy = Na__LePanels__Note('');
        infillWhy.setAttribute('data-na-param', 'infill-why');
        infill.appendChild(infillWhy);
        infill.appendChild(Na__LePanels__Row(L('PropsInfillRun', 'Words run'), Na__LePanels__Select('param-infill-run', [], null)));
        infill.appendChild(Na__LePanels__Row(L('PropsInfillFill', 'White fill underneath'), Na__LePanels__Input('checkbox', 'param-infill-fill'), 'na-le-row--toggle'));
        const infillColour = Na__LePanels__Row(L('PropsInfillFillColour', 'Fill colour'), Na__LePanels__Input('color', 'param-infill-fill-colour'));
        infillColour.setAttribute('data-na-param', 'infill-fill-colour');
        infill.appendChild(infillColour);
        infill.appendChild(Na__LePanels__Row(L('PropsInfillWidth', 'Width (mm)'), Na__LePanels__Input('number', 'param-infill-width', { min : 2, max : 800, step : 0.1 })));
        infill.appendChild(Na__LePanels__Row(L('PropsInfillHeight', 'Height (mm)'), Na__LePanels__Input('number', 'param-infill-height', { min : 2, max : 800, step : 0.1 })));
        const infillSize = Na__LePanels__Note('');
        infillSize.setAttribute('data-na-param', 'infill-size-note');
        infill.appendChild(infillSize);
        infill.appendChild(Na__LePanels__Row(L('PropsInfillTextSize', 'Text size (mm)'), Na__LePanels__Input('number', 'param-infill-size', { min : 0.8, max : 12, step : 0.1 })));
        infill.appendChild(Na__LePanels__Note(L('PropsInfillKept', 'Anything restyled inside the group - a colour, a line weight, the dashes - is kept when it is rebuilt.')));
        body.appendChild(infill);

        const foot = Na__LePanels__Note('');
        foot.setAttribute('data-na-param', 'foot');
        body.appendChild(foot);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Real-World Size as the Split List Writes It
    // ------------------------------------------------------------
    function Na__LePanelParam__SizeLabel(sizeMm) {
        return sizeMm >= 1000 ? (String(Math.round(sizeMm) / 1000) + ' m') : (String(Math.round(sizeMm)) + ' mm');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selected Element
    // ------------------------------------------------------------
    // A control being typed into is left alone, as in every panel.
    // ------------------------------------------------------------
    function Na__LePanelParam__RefreshProps(body) {
        const picked = Na__LePanelParam__Selected();
        if (!picked || !picked.params) return;
        const L      = Na__LeParam__Label;
        const params = picked.params;
        const locked = Na__LeParam__IsLocked(picked.sheet, picked.groupId);
        const usable = Na__LePanels__IsEditable() && !locked;
        const el     = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const part   = (name) => body.querySelector('[data-na-param="' + name + '"]');

        part('name').textContent = Na__LeParam__TypeName(picked.type.type);
        const isTitle  = picked.type.type === Na__LeParamTitle__TYPE;
        const isPortal = picked.type.type === Na__LeParamQr__TYPE;
        const isArea   = picked.type.type === Na__LeParamArea__TYPE;
        const isInfill = picked.type.type === Na__LeParamInfill__TYPE;
        const hasBar   = (typeof picked.type.hasBar === 'function') ? picked.type.hasBar(params) : true;   // <-- A type that does not say is a bar
        const linkable = Na__LeParam__IsLinkable(picked.type.type);
        part('title-block').hidden = !isTitle;
        part('bar-block').hidden   = !hasBar;
        part('qr-block').hidden    = !isPortal;
        part('area-block').hidden  = !isArea;
        part('infill-block').hidden = !isInfill;
        part('link-row').hidden    = !linkable;                                 // <-- An element that is never tied to a drawing is shown no cable to tie
        if (isTitle)  Na__LePanelParam__RefreshTitle(body, picked, usable);
        if (isPortal) Na__LePanelParam__RefreshPortal(body, picked, usable);
        if (isArea)   Na__LePanelParam__RefreshSchedule(body, picked, usable);
        if (isInfill) Na__LePanelParam__RefreshInfill(body, picked, usable);

        // A TYPE WITH NO SCALE HAS NOTHING BELOW THIS LINE TO REFLECT, and the
        // rows are hidden anyway. Filled in regardless, an undefined scale
        // would go into the scale list and an undefined count into the
        // divisions box, and both would be waiting there the next time a bar
        // was selected.
        if (!linkable && !hasBar) {
            [ 'param-link' ].concat(Na__LePanelParam__BAR_CONTROLS).forEach((name) => { el(name).disabled = true; });
            part('foot').textContent = locked ? L('PropsLocked', 'Its layer is locked.') : L('PropsExplode', 'Ungroup it (Ctrl+Shift+G) to explode it into plain vectors and text.');
            return;
        }

        const tied     = Na__LeParamLink__DescribeById(picked.sheet, picked.groupId);
        const choosable = Na__LeParamLink__Candidates(picked.sheet);
        const sheetIs   = L('PropsLinkSheet', 'The sheet\'s scale ({scale})', { scale : Na__LeDrawScale__Label(Na__LeDrawScale__SheetDenominator(picked.sheet)) });
        Na__LePanels__FillSelect(el('param-link'),
            [ { value : Na__LePanelParam__NO_LINK, label : L('PropsLinkNone', 'Not linked') }, { value : Na__LePanelParam__SHEET_LINK, label : sheetIs } ]
                .concat(choosable.map((viewport) => ({ value : viewport.Viewport__Id, label : Na__LeParamLink__ViewportName(viewport) }))),
            tied.kind === Na__LeParamLink__KIND_VIEWPORT ? tied.viewport.Viewport__Id : (tied.kind === Na__LeParamLink__KIND_SHEET ? Na__LePanelParam__SHEET_LINK : Na__LePanelParam__NO_LINK));

        const listed = Na__LeParam__Block('ScaleBar').ScaleBar__MenuScaleDenominators;
        const scales = (Array.isArray(listed) ? listed : []).filter((d) => typeof d === 'number' && d > 0);
        if (scales.indexOf(params.ScaleDenominator) === -1) scales.push(params.ScaleDenominator);   // <-- A viewport's scale, or a solved one, that the list leaves out
        scales.sort((a, b) => a - b);
        Na__LePanels__FillSelect(el('param-scale'), scales.map((d) => ({ value : d, label : Na__LeDrawScale__Label(d) })), params.ScaleDenominator);

        const divisions = el('param-divisions');
        const bar       = Na__LeParam__Block('ScaleBar');
        if (Number.isFinite(bar.ScaleBar__MinDivisions)) divisions.min = String(bar.ScaleBar__MinDivisions);
        if (Number.isFinite(bar.ScaleBar__MaxDivisions)) divisions.max = String(bar.ScaleBar__MaxDivisions);
        if (document.activeElement !== divisions) divisions.value = String(params.Divisions);

        const told = (typeof picked.type.describe === 'function') ? picked.type.describe(params) : null;
        part('length').textContent = told ? L('PropsLength', '{real} long, {paper} mm on the paper.', told) : '';

        el('param-subdivide').checked = params.SubdivideFirst === true;
        const choices = (typeof picked.type.subdivisionChoices === 'function') ? picked.type.subdivisionChoices(params) : [];
        if (choices.indexOf(params.SubdivisionMm) === -1) choices.push(params.SubdivisionMm);
        choices.sort((a, b) => a - b);
        Na__LePanels__FillSelect(el('param-subdivision'), choices.map((sizeMm) => ({ value : sizeMm, label : Na__LePanelParam__SizeLabel(sizeMm) })), params.SubdivisionMm);
        part('into').hidden = params.SubdivideFirst !== true;
        el('param-units').checked = params.ShowUnits === true;

        [ 'param-link' ].concat(Na__LePanelParam__BAR_CONTROLS).forEach((name) => { el(name).disabled = !usable; });
        part('foot').textContent = locked ? L('PropsLocked', 'Its layer is locked.') : L('PropsExplode', 'Ungroup it (Ctrl+Shift+G) to explode it into plain vectors and text.');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect a Selected Drawing Title
    // ------------------------------------------------------------
    // What it reads, and - when it still holds a placeholder, or has stopped
    // following its drawing - the one sentence that says why and what to do.
    // ------------------------------------------------------------
    function Na__LePanelParam__RefreshTitle(body, picked, usable) {
        const L      = Na__LeParam__Label;
        const params = picked.params;
        const el     = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const part   = (name) => body.querySelector('[data-na-param="' + name + '"]');
        const told   = (typeof picked.type.titleText === 'function') ? picked.type.titleText(params) : { text : '', resolved : true, missing : [] };

        part('title-reads').textContent = L('PropsTitleReads', 'Reads: {text}', { text : told.text });
        let why = '';
        if (params.TitleText !== '') why = L('PropsTitleTyped', 'Typed by hand, so it no longer follows its drawing. Clear the box to go back to automatic.');
        else if (told.missing.indexOf(Na__LeViewText__MISSING_DRAWING) !== -1) why = L('PropsNeedsLink', 'Tie it to a drawing to fill {{Drawing}}: drag its round socket onto one.');
        else if (told.missing.indexOf(Na__LeViewText__MISSING_DIRECTION) !== -1 && !Na__LeViewId__IsNorthSet()) why = L('PropsNeedsNorth', '{{Direction}} fills itself in once north is set in the 3D model: Dev Tools, North Direction, Draw Compass.');
        else if (told.source === Na__LeViewText__SOURCE_NAME) why = L('PropsTitleNamed', 'The drawing\'s viewport has a typed name, which the title uses. Clear that name and the title is written from the model and north.');   // <-- Asked of the sentence, not of ViewName: a typed "Proposed Floor Plan" gives way to the plan's storey and is NOT what the title uses
        else if (told.source === Na__LeViewText__SOURCE_LEVEL) why = L('PropsTitleStorey', 'Written from the plan\'s storey, which is chosen per floor plan in the 3D view: Dev Tools, Floor Plans, Storey.');
        part('title-why').textContent = why;
        part('title-why').hidden      = why === '';

        Na__LePanels__FillSelect(el('param-title-phase'), [
            { value : Na__LeViewText__MODE_AUTO,     label : L('PropsPhaseAuto', 'Automatic (from the model)') },
            { value : Na__LeViewText__MODE_EXISTING, label : L('PropsPhaseExisting', 'Existing') },
            { value : Na__LeViewText__MODE_PROPOSED, label : L('PropsPhaseProposed', 'Proposed') },
            { value : Na__LeViewText__MODE_NONE,     label : L('PropsPhaseNone', 'Leave it out') }
        ], params.PhaseMode);
        const typed = el('param-title-text');
        if (document.activeElement !== typed) typed.value = params.TitleText;
        el('param-title-upper').checked = params.Uppercase === true;
        const underline = el('param-title-underline');
        const block     = Na__LeParam__Block('DrawingTitle');
        if (Number.isFinite(block.DrawingTitle__UnderlineMinMm))  underline.min  = String(block.DrawingTitle__UnderlineMinMm);
        if (Number.isFinite(block.DrawingTitle__UnderlineMaxMm))  underline.max  = String(block.DrawingTitle__UnderlineMaxMm);
        if (Number.isFinite(block.DrawingTitle__UnderlineStepMm)) underline.step = String(block.DrawingTitle__UnderlineStepMm);
        if (document.activeElement !== underline) underline.value = String(params.UnderlineMm);
        el('param-title-bar').checked = params.ShowScaleBar === true;

        const hasBar = params.ShowScaleBar === true;
        const right  = hasBar && params.BarPlacement === Na__LeParamTitle__PLACE_RIGHT;
        part('bar-place').hidden = !hasBar;                                     // <-- Nowhere for a bar to sit when there is no bar
        Na__LePanels__FillSelect(el('param-title-bar-place'), [
            { value : Na__LeParamTitle__PLACE_BELOW, label : L('PropsBarBelow', 'Under the title') },
            { value : Na__LeParamTitle__PLACE_RIGHT, label : L('PropsBarRight', 'To the right of it') }
        ], params.BarPlacement);
        part('bar-offset').hidden      = !right;
        part('bar-offset-note').hidden = !right;
        part('bar-offset-note').textContent = L('PropsBarOffsetNote', 'From the title\'s left edge to the bar\'s zero end, in 50 mm steps.');
        const across = el('param-title-bar-offset');
        if (Number.isFinite(block.DrawingTitle__BarOffsetMinMm))  across.min  = String(block.DrawingTitle__BarOffsetMinMm);
        if (Number.isFinite(block.DrawingTitle__BarOffsetMaxMm))  across.max  = String(block.DrawingTitle__BarOffsetMaxMm);
        if (Number.isFinite(block.DrawingTitle__BarOffsetStepMm)) across.step = String(block.DrawingTitle__BarOffsetStepMm);
        if (document.activeElement !== across) across.value = String(params.BarOffsetMm);

        Na__LePanelParam__TITLE_CONTROLS.forEach((name) => { el(name).disabled = !usable; });
        el('param-title-phase').disabled = !usable || params.TitleText !== '';   // <-- A typed title has no qualifier to choose
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect a Selected Project Portal Block
    // ------------------------------------------------------------
    // What it names the project, and - when the name is still a placeholder,
    // or has been typed over - the one sentence that says why and what to do.
    // The description's width is the full form's alone and is hidden with it.
    // ------------------------------------------------------------
    function Na__LePanelParam__RefreshPortal(body, picked, usable) {
        const L      = Na__LeParam__Label;
        const params = picked.params;
        const el     = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const part   = (name) => body.querySelector('[data-na-param="' + name + '"]');
        const told   = (typeof picked.type.projectText === 'function') ? picked.type.projectText(params, { projectName : Na__LePanelParam__ProjectName }) : { text : '', resolved : true, typed : false };

        part('qr-reads').textContent = L('PropsQrReads', 'Names: {text}', { text : told.text });
        let why = '';
        if (told.typed)          why = L('PropsQrTyped', 'Typed by hand, so it no longer follows the project. Clear the box to go back to automatic.');
        else if (!told.resolved) why = L('PropsQrNeedsName', '{{Project}} fills itself in once the project\'s data has loaded. Type a name here to letter one now.');
        part('qr-why').textContent = why;
        part('qr-why').hidden      = why === '';

        const sizes = (typeof picked.type.sizeChoices === 'function') ? picked.type.sizeChoices() : [];
        if (sizes.indexOf(params.SizeMm) === -1) sizes.push(params.SizeMm);     // <-- A size typed into the file by hand that the list leaves out
        sizes.sort((a, b) => a - b);
        Na__LePanels__FillSelect(el('param-qr-size'), sizes.map((sizeMm) => ({ value : sizeMm, label : String(sizeMm) + ' mm' })), params.SizeMm);

        Na__LePanels__FillSelect(el('param-qr-form'), [
            { value : Na__LeParamQr__FORM_COMPACT, label : L('PropsQrFormCompact', 'Code and list') },
            { value : Na__LeParamQr__FORM_FULL,    label : L('PropsQrFormFull', 'The full description too') }
        ], params.Form);

        const full  = params.Form === Na__LeParamQr__FORM_FULL;
        const block = Na__LeParam__Block('ProjectQr');
        part('qr-width').hidden      = !full;
        part('qr-width-note').hidden = !full;
        part('qr-width-note').textContent = L('PropsQrWidthNote', 'How wide the paragraph is set, in 5 mm steps. On the sheet, drag the arrow at the end of it.');
        const width = el('param-qr-width');
        if (Number.isFinite(block.ProjectQr__BodyWidthMinMm))  width.min  = String(block.ProjectQr__BodyWidthMinMm);
        if (Number.isFinite(block.ProjectQr__BodyWidthMaxMm))  width.max  = String(block.ProjectQr__BodyWidthMaxMm);
        if (Number.isFinite(block.ProjectQr__BodyWidthStepMm)) width.step = String(block.ProjectQr__BodyWidthStepMm);
        if (document.activeElement !== width) width.value = String(params.BodyWidthMm);

        const typed = el('param-qr-project');
        if (document.activeElement !== typed) typed.value = params.ProjectName;

        Na__LePanelParam__QR_CONTROLS.forEach((name) => { el(name).disabled = !usable; });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect a Selected Area Schedule
    // ------------------------------------------------------------
    // What it is reporting, then the choices about how it reports it. The
    // group list is built from the numbers the table is holding, so it offers
    // exactly the groups the sheet has - and says so in words when the sheet
    // has no measured rooms at all, which is the state somebody who has just
    // dropped a table is most likely to be looking at.
    // ------------------------------------------------------------
    function Na__LePanelParam__RefreshSchedule(body, picked, usable) {
        const L      = Na__LeParam__Label;
        const params = picked.params;
        const el     = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const part   = (name) => body.querySelector('[data-na-param="' + name + '"]');
        const rows   = (typeof picked.type.rowsOf === 'function') ? picked.type.rowsOf(params) : [];
        const data   = params.Data || { Areas : [], Groups : [], TotalM2 : 0 };

        const project = params.Form === Na__LeParamArea__FORM_PROJECT;
        part('area-reads').textContent = data.Areas.length || data.Groups.length
            ? L(project ? 'PropsAreaReadsProject' : 'PropsAreaReads', '{count} rows, {total} in total.', { count : rows.filter((row) => row.kind !== 'empty').length, total : (typeof picked.type.figure === 'function' ? picked.type.figure(params, data.TotalM2) : String(data.TotalM2)) })
            : (project ? L('PropsAreaEmptyProject', 'No rooms filed under a group have been measured on any sheet yet.') : L('PropsAreaEmpty', 'No rooms have been measured on this sheet yet.'));

        Na__LePanels__FillSelect(el('param-area-form'), [
            { value : Na__LeParamArea__FORM_AREAS,   label : L('MenuAreaFormAreas', 'Every area, by group') },
            { value : Na__LeParamArea__FORM_GROUPS,  label : L('MenuAreaFormGroups', 'Totals by group') },
            { value : Na__LeParamArea__FORM_PROJECT, label : L('MenuAreaFormProject', 'Totals by group, whole project') }
        ], params.Form);

        // THE FLOOR AFTER THE TITLE | The config's floors in its order, and
        // any other words the table already carries, so the list never shows
        // a choice the paper does not.
        const floors = (typeof picked.type.suffixes === 'function') ? picked.type.suffixes() : [];
        const suffix = params.TitleSuffix || '';
        if (suffix !== '' && floors.every((floor) => floor.toLowerCase() !== suffix.toLowerCase())) floors.push(suffix);
        Na__LePanels__FillSelect(el('param-area-suffix'),
            [ { value : '', label : L('MenuAreaNoSuffix', 'No floor in the title') } ].concat(floors.map((floor) => ({ value : floor, label : floor }))),
            floors.find((floor) => floor.toLowerCase() === suffix.toLowerCase()) || '');

        Na__LePanels__FillSelect(el('param-area-group'),
            [ { value : '', label : L('PropsAreaGroupAll', 'Every group') } ]
                .concat(data.Groups.filter((group) => !!group.Name).map((group) => ({ value : group.Name, label : group.Name }))),
            params.Group);

        Na__LePanels__FillSelect(el('param-area-units'), [
            { value : 'm2',   label : L('MenuAreaUnitsM2', 'Square metres') },
            { value : 'ft2',  label : L('MenuAreaUnitsFt2', 'Square feet') },
            { value : 'both', label : L('MenuAreaUnitsBoth', 'Both, feet in brackets') }
        ], params.Units);

        const typed = el('param-area-title');
        if (document.activeElement !== typed) typed.value = params.TitleText;
        const width = el('param-area-width');
        if (document.activeElement !== width) width.value = String(params.WidthMm);
        const size = el('param-area-text');
        if (document.activeElement !== size) size.value = String(params.TextSizeMm);
        const places = el('param-area-decimals');
        if (document.activeElement !== places) places.value = String(params.Decimals);
        el('param-area-headings').checked = params.ShowGroups === true;
        el('param-area-total').checked    = params.ShowTotal === true;
        el('param-area-swatch').checked   = params.ShowSwatch === true;
        part('area-headings-row').hidden  = params.Form !== Na__LeParamArea__FORM_AREAS;   // <-- A table of groups IS its headings

        Na__LePanelParam__AREA_CONTROLS.forEach((name) => { el(name).disabled = !usable; });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Colour as a Colour Box Can Show It (#rrggbb)
    // ------------------------------------------------------------
    // A member recoloured by hand may carry a short or an alpha form; the box
    // takes six digits or nothing.
    // ------------------------------------------------------------
    function Na__LePanelParam__Hex(value, fallback) {
        const text = String(value || '').trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(text)) return text;
        if (/^#[0-9a-f]{8}$/.test(text)) return text.slice(0, 7);
        if (/^#[0-9a-f]{3}$/.test(text)) return '#' + text[1] + text[1] + text[2] + text[2] + text[3] + text[3];
        return fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect a Selected Cabinet Infill
    // ------------------------------------------------------------
    // What it reads; the listed words, and - while typed words are in force -
    // the one sentence that says so and how to go back; which way the words
    // run; the fill and its colour; the size on the paper and, when it lies
    // on a drawing, on the ground at that drawing's scale; the text size.
    // Every value comes through the engine, which reads the members, so a fill
    // recoloured inside the group shows here as the colour it is.
    // ------------------------------------------------------------
    function Na__LePanelParam__RefreshInfill(body, picked, usable) {
        const L      = Na__LeParam__Label;
        const params = picked.params;
        const el     = (name) => body.querySelector('[data-na-control="' + name + '"]');
        const part   = (name) => body.querySelector('[data-na-param="' + name + '"]');
        const told   = (typeof picked.type.labelOf === 'function') ? picked.type.labelOf(params) : { text : params.Label, typed : false };
        const style  = (typeof picked.type.styleOf === 'function') ? picked.type.styleOf(params) : {};
        const block  = Na__LeParam__Block('CabinetInfill');

        part('infill-reads').textContent = L('PropsInfillReads', 'Reads: {text}', { text : told.text });
        const presets = (typeof picked.type.presets === 'function') ? picked.type.presets() : [];
        if (presets.indexOf(params.Label) === -1) presets.push(params.Label);   // <-- Words from an older list, or written into the file, that this list leaves out
        Na__LePanels__FillSelect(el('param-infill-label'), presets.map((label) => ({ value : label, label : label })), params.Label);
        const typed = el('param-infill-text');
        typed.placeholder = params.Label;                                      // <-- An empty box shows the listed word it gives way to
        if (document.activeElement !== typed) typed.value = params.LabelText;
        part('infill-why').textContent = told.typed ? L('PropsInfillTyped', 'Typed by hand, so the list no longer sets it. Clear the box, or pick from the list, to go back.') : '';
        part('infill-why').hidden      = !told.typed;

        Na__LePanels__FillSelect(el('param-infill-run'), [
            { value : Na__LeParamInfill__RUN_AUTO,   label : L('PropsInfillRunAuto', 'Along the longer side') },
            { value : Na__LeParamInfill__RUN_ACROSS, label : L('PropsInfillRunAcross', 'Across the sheet') },
            { value : Na__LeParamInfill__RUN_UP,     label : L('PropsInfillRunUp', 'Up the sheet') }
        ], params.Orientation);

        el('param-infill-fill').checked   = params.Fill === true;
        part('infill-fill-colour').hidden = params.Fill !== true;               // <-- No fill, no colour to give it
        const colour = el('param-infill-fill-colour');
        if (document.activeElement !== colour) colour.value = Na__LePanelParam__Hex(style.fillColour, '#ffffff');

        [ [ 'param-infill-width', params.WidthMm ], [ 'param-infill-height', params.HeightMm ] ].forEach((pair) => {
            const input = el(pair[0]);
            if (Number.isFinite(block.CabinetInfill__SizeMinMm))  input.min  = String(block.CabinetInfill__SizeMinMm);
            if (Number.isFinite(block.CabinetInfill__SizeMaxMm))  input.max  = String(block.CabinetInfill__SizeMaxMm);
            if (Number.isFinite(block.CabinetInfill__SizeStepMm)) input.step = String(block.CabinetInfill__SizeStepMm);
            if (document.activeElement !== input) input.value = String(pair[1]);
        });
        const anchor  = Na__LeParam__AnchorOf(picked.sheet, picked.groupId);
        const drawing = anchor ? Na__LeParamLink__Nearest(picked.sheet, { x : anchor.x + (params.WidthMm / 2), y : anchor.y + (params.HeightMm / 2) }, 0) : null;   // <-- The drawing it lies on, if any
        const d       = drawing ? drawing.Viewport__ScaleDenominator : null;
        part('infill-size-note').textContent = d
            ? L('PropsInfillOnDrawing', '{width} x {height} mm on the drawing at {scale}. Drag the hollow grip at its bottom left corner onto a corner of the cabinet, then any other corner onto the one opposite - both snap to the drawing.',
                { width : Math.round(params.WidthMm * d), height : Math.round(params.HeightMm * d), scale : Na__LeDrawScale__Label(d) })
            : L('PropsInfillOffDrawing', 'Paper millimetres. Drag the hollow grip at its bottom left corner onto a corner of the cabinet, then any other corner onto the one opposite - both snap to the drawing.');

        const size = el('param-infill-size');
        if (Number.isFinite(block.CabinetInfill__TextSizeMinMm)) size.min = String(block.CabinetInfill__TextSizeMinMm);
        if (Number.isFinite(block.CabinetInfill__TextSizeMaxMm)) size.max = String(block.CabinetInfill__TextSizeMaxMm);
        if (document.activeElement !== size) size.value = String(params.TextSizeMm);

        Na__LePanelParam__INFILL_CONTROLS.forEach((name) => { el(name).disabled = !usable; });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show the Settings Only While One Parametric Element Is Selected
    // ------------------------------------------------------------
    function Na__LePanelParam__SyncProps() {
        const show = !!Na__LePanelParam__Selected();
        Na__LePanels__SetSectionVisible(Na__LePanelParam__PROPS_ID, show);
        if (show) Na__LePanels__Refresh(Na__LePanelParam__PROPS_ID);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Model Change Arrives
    // ------------------------------------------------------------
    function Na__LePanelParam__OnModelChanged(event) {
        const reason = (event && event.detail) ? event.detail.reason : '';
        if (Na__LePanelParam__LIBRARY_SHOWS.indexOf(reason) !== -1) Na__LePanelParam__SyncLibrary();
        if (Na__LePanelParam__PROPS_SHOWS.indexOf(reason) !== -1) Na__LePanelParam__SyncProps();
        if (reason === 'active' || reason === 'loaded') Na__LePanelParam__AwaitMetrics();   // <-- Only does anything after a load that threw
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Settings Section and Its Controls (right column)
    // ------------------------------------------------------------
    // Every control is one undo step. A scale picked by hand lets go of the
    // viewport; a viewport picked takes its scale; either puts the element
    // back to its standard at the new scale, as the lookup grip's menu does.
    // ------------------------------------------------------------
    function Na__LePanelParam__RegisterProperties() {
        Na__LePanelParam__Wire();
        const on      = Na__LePanels__OnControl;
        const guarded = (run) => (event, el) => {
            const picked = Na__LePanelParam__Selected();
            if (!picked || !Na__LePanels__IsEditable() || Na__LeParam__IsLocked(picked.sheet, picked.groupId)) return;
            run(picked, el);
        };
        on('change', 'param-link',        guarded((picked, el) => {
            if (el.value === Na__LePanelParam__SHEET_LINK) Na__LeParamLink__SetSheetLink(picked.sheet, picked.groupId);
            else Na__LeParamLink__SetLink(picked.sheet, picked.groupId, el.value === Na__LePanelParam__NO_LINK ? null : el.value);
        }));
        on('change', 'param-scale',       guarded((picked, el) => { const d = parseFloat(el.value); if (Number.isFinite(d) && d > 0) Na__LeParam__ResetToStandard(picked.sheet, picked.groupId, d, { link : null }); }));
        on('change', 'param-divisions',   guarded((picked, el) => { const n = parseInt(el.value, 10); if (Number.isFinite(n)) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Divisions : n }); }));
        on('change', 'param-subdivide',   guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { SubdivideFirst : el.checked })));
        on('change', 'param-subdivision', guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { SubdivisionMm : mm }); }));
        on('change', 'param-units',       guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { ShowUnits : el.checked })));
        on('click',  'param-reset',       guarded((picked) => Na__LeParam__ResetToStandard(picked.sheet, picked.groupId, picked.params.ScaleDenominator)));
        on('change', 'param-title-text',      guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { TitleText : el.value })));
        on('change', 'param-title-phase',     guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { PhaseMode : el.value })));
        on('change', 'param-title-upper',     guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Uppercase : el.checked })));
        on('change', 'param-title-underline', guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { UnderlineMm : mm }); }));
        on('change', 'param-title-bar',       guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { ShowScaleBar : el.checked })));
        on('change', 'param-title-bar-place', guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { BarPlacement : el.value })));
        on('change', 'param-title-bar-offset', guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm)) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { BarOffsetMm : mm }); }));
        on('change', 'param-qr-size',    guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { SizeMm : mm }); }));
        on('change', 'param-qr-form',    guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Form : el.value })));
        on('change', 'param-qr-width',   guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { BodyWidthMm : mm }); }));
        on('change', 'param-qr-project', guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { ProjectName : el.value })));
        on('change', 'param-area-form',     guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Form : el.value })));
        on('change', 'param-area-group',    guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Group : el.value })));
        on('change', 'param-area-title',    guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { TitleText : el.value })));
        on('change', 'param-area-suffix',   guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { TitleSuffix : el.value })));
        on('change', 'param-area-units',    guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Units : el.value })));
        on('change', 'param-area-decimals', guarded((picked, el) => { const n = parseInt(el.value, 10); if (Number.isFinite(n)) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Decimals : n }); }));
        on('change', 'param-area-width',    guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { WidthMm : mm }); }));
        on('change', 'param-area-text',     guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { TextSizeMm : mm }); }));
        on('change', 'param-area-headings', guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { ShowGroups : el.checked })));
        on('change', 'param-area-total',    guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { ShowTotal : el.checked })));
        on('change', 'param-area-swatch',   guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { ShowSwatch : el.checked })));
        on('change', 'param-infill-label',       guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Label : el.value, LabelText : '' })));   // <-- A word picked from the list is the answer: it clears any typed over it
        on('change', 'param-infill-text',        guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { LabelText : el.value })));
        on('change', 'param-infill-run',         guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Orientation : el.value })));
        on('change', 'param-infill-fill',        guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { Fill : el.checked })));
        on('change', 'param-infill-fill-colour', guarded((picked, el) => Na__LeParam__Regenerate(picked.sheet, picked.groupId, { FillColour : el.value })));
        on('change', 'param-infill-width',       guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { WidthMm : mm }); }));
        on('change', 'param-infill-height',      guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { HeightMm : mm }); }));
        on('change', 'param-infill-size',        guarded((picked, el) => { const mm = parseFloat(el.value); if (Number.isFinite(mm) && mm > 0) Na__LeParam__Regenerate(picked.sheet, picked.groupId, { TextSizeMm : mm }); }));
        const entry = Na__LePanels__RegisterSection('right', {
            id : Na__LePanelParam__PROPS_ID, title : Na__LeParam__Label('PropsTitle', 'Parametric Element'),
            build : Na__LePanelParam__BuildProps, refresh : Na__LePanelParam__RefreshProps
        });
        Na__LePanels__SetSectionVisible(Na__LePanelParam__PROPS_ID, false);      // <-- Hidden until a parametric element is selected
        Na__LeParam__Ready().then(() => {
            const title = entry ? entry.root.querySelector('.na-le-section__title') : null;
            if (title) title.textContent = Na__LeParam__Label('PropsTitle', 'Parametric Element');
            Na__LePanelParam__SyncProps();
        });
        return entry;
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Library Section (the right column's Scrapbook tab)
    // ------------------------------------------------------------
    function Na__LePanelParam__RegisterLibrary() {
        Na__LePanelParam__Wire();
        const entry = Na__LePanels__RegisterSection('right', {
            id : Na__LePanelParam__LIBRARY_ID, title : Na__LeParam__Label('LibraryTitle', 'Parametric Scrapbook'), tab : Na__LeScrap__TAB_ID,
            build : Na__LePanelParam__BuildLibrary, refresh : Na__LePanelParam__RefreshLibrary
        });
        Na__LePanels__SetSectionVisible(Na__LePanelParam__LIBRARY_ID, false);    // <-- Hidden until the config says the active sheet has elements
        Na__LeParam__Ready().then(() => {
            const title = entry ? entry.root.querySelector('.na-le-section__title') : null;
            if (title) title.textContent = Na__LeParam__Label('LibraryTitle', 'Parametric Scrapbook');
            Na__LePanelParam__SyncLibrary();
        });
        return entry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Parametric Scrapbook Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelParam__RegisterProperties,
        Na__LePanelParam__RegisterLibrary
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
