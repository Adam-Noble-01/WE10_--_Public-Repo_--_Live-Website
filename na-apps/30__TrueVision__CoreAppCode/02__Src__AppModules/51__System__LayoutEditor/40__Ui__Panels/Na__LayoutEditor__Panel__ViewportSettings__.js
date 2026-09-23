// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: VIEWPORT SETTINGS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__ViewportSettings__.js
// NAMESPACE  : Na__LePanelViewport
// MODULE     : Layout Editor - Panel Viewport Settings
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Add a viewport; for the selected one: scene, scale, frame, pan, markup mode, import, edit in drawing
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The scene select is grouped by scene group (plans, elevations, cross
//   sections, 3D views). A drawing scene makes a 2D viewport carrying its
//   drawing id; any other scene makes a 3D snapshot viewport (D28, D30).
// - Model Source (TrueVision): on a project with more than one design phase,
//   which phase the viewport draws - for the selected viewport, and for the
//   next one added. Hidden on a project with a single model.
// - Scale is a row of toggle buttons (D27) on 2D viewports, one per locked
//   scale - 1:20, 1:50, 1:100 and 1:200 as shipped; the frame and pan
//   readouts are editable numbers in paper and drawing millimetres; the
//   markup mode switch, Import From Scene and Edit In Drawing implement
//   D34 (editing of scene markup happens in the drawing itself).
// - Rotation deg: the whole viewport turned about the middle of its frame,
//   degrees clockwise (Viewport__RotationDeg), typed to a decimal place, a
//   quarter turn either way (-90, +90) or back to Level. The rotate grip over
//   the selected frame does the same by hand. Greyed out while locked.
// - Zoom % (3D viewports only): how large the picture is drawn in its frame,
//   typed to a decimal place and applied about the middle of the frame; Reset
//   puts it back to 100 percent, centred. The wheel does the same about the
//   cursor while the viewport's content is being edited
//   (Na__LayoutEditor__Viewport3dZoom__). Greyed out while the viewport or its
//   layer is locked.
// - Frame hides the border and caption drawn round the viewport; Caption
//   hides the caption alone, so it only counts while the frame shows.
// - Doors (plans only) says how many doors the viewport draws shut - a plan
//   draws the rest open - and Open all puts every one back. A door is shut or
//   opened by clicking it on the plan (Na__LayoutEditor__PlanDoors__). Hide
//   swings, beside Open all, leaves every door swing off the plan; a roof
//   plan starts with it ticked, and the note says so.
//
// INTEGRATION:
// - Registered into the right column by the mode controller, which also
//   answers the Edit In Drawing request event.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__Panel__ViewportSettings__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers; site plan drawings (site plan viewports), TrueVision first on 14-Sep-2026.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.10.0 (TrueVision)
// - A viewport added while a group is open for editing - a scene, or a site
//   plan - joins that group (Na__LeScope__WithAdoption), in the same undo
//   step, now that a group may hold viewports (Na__LayoutEditor__Groups__
//   1.4.0). It used to land on the sheet outside the group, out of reach.
//
// 21-Sep-2026 - Version 1.9.0 (TrueVision)
// - Hide swings: a checkbox on the Doors row, beside Open all. Ticked, the
//   plan draws no door swing (Viewport__HideSwings, one undo step, through
//   Na__LeDoors__SetSwingsHidden). While nobody has ticked or unticked it the
//   plan's storey decides - a roof plan reads ticked - and the doors note adds
//   "Swings are hidden by default on a roof plan." Greyed out only when the
//   panel is read only: a lock holds the frame, not the doors.
// - Scale gains 1:200 from the config list; nothing here names a scale.
//
// 21-Sep-2026 - Version 1.8.0 (TrueVision)
// - Rotation deg under Frame mm: a number box for the viewport's turn (to a
//   decimal place, wrapped into -180 to 180, one undo step), -90 and +90 for a
//   quarter turn either way, and Level. Greyed out when the viewport or its
//   layer is locked.
//
// 14-Sep-2026 - Version 1.7.0
// - Zoom % on 3D viewports: a number box for the picture's zoom (to a decimal
//   place, one undo step, about the middle of the frame) and Reset (100 percent,
//   centred). Hidden on 2D and site plan viewports, greyed out when locked.
//
// 14-Sep-2026 - Version 1.6.0
// - Site plan sheets. Add Viewport offers the site plan scales - 1:500 Block Plan
//   or 1:1250 Location Plan - with a note of the project's site plan data. The new
//   viewport is centred on the red line, and every layer whose export does not list
//   that scale starts switched off. A site plan viewport's settings show its own
//   scale toggle and hide the scene, model source, markup and scene actions.
//
// 14-Sep-2026 - Version 1.5.0
// - Doors: a row on plan viewports under Locked. Its note says whether every
//   door is drawn open or how many the viewport has shut, and how to change
//   that on the plan; Open all opens every shut door in one undo step. The row
//   is a div, not a label, so a click on its caption never presses the button.
//
// 14-Sep-2026 - Version 1.4.0
// - Frame: a checkbox above Caption that hides the viewport's frame and its
//   caption together, on the sheet and in the PDF (Viewport__ShowFrame). They
//   help while a sheet is set out; untick once it is, to title the view by
//   hand. Caption greys out while the frame is hidden and keeps its own
//   setting for when the frame comes back.
//
// 13-Sep-2026 - Version 1.3.0
// - Model Source: a select under Scene for the selected viewport, one beside
//   the Add Viewport scene, and a note that says when the viewport's phase is
//   loading, failed, or is not in the project. Changing the scene keeps the
//   model source; it is a separate choice.
//
// 10-Sep-2026 - Version 1.2.0
// - The global raster level (Low, Medium, High) sits above the viewport settings, where it is looked for.
//
// 10-Sep-2026 - Version 1.1.0
// - Locked checkbox.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Scale, Layout, Model, Panels, Viewports, Markup
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetViewportSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeScale__ListDenominators, Na__LeScale__FormatLabel } from '../07__Core__SheetData/Na__LayoutEditor__ScaleManager__.js';
    import { Na__LeLayout__Solve, Na__LeLayout__DefaultViewportRect } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__KIND_3D,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetLayers,
        Na__LeModel__DefaultLayerId,
        Na__LeModel__CreateViewport,
        Na__LeModel__UpdateViewport,
        Na__LeModel__GetSelectedViewport,
        Na__LeModel__SetSelection,
        Na__LeModel__ResolveViewportSource,
        Na__LeModel__IsSitePlanSheet,
        Na__LeModel__IsSitePlanViewport,
        Na__LeModel__IsLayerLocked
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeVpZoom__Get, Na__LeVpZoom__Percent, Na__LeVpZoom__PatchAbout, Na__LeVpZoom__PatchReset } from '../20__System__Viewports/Na__LayoutEditor__Viewport3dZoom__.js';
    import { Na__LeVpRot__Deg, Na__LeVpRot__WrapDeg } from '../20__System__Viewports/Na__LayoutEditor__ViewportRotation__.js';   // <-- A leaf: the viewport's turn
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__OnControl,
        Na__LePanels__IsEditable,
        Na__LePanels__GetContext,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__FillSelect,
        Na__LePanels__Button,
        Na__LePanels__Note,
        Na__LePanels__Refresh
    } from './Na__LayoutEditor__PanelHost__.js';
    import { Na__LeVp2d__Describe, Na__LeVp2d__CentreOnDrawing } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeRaster__LEVELS, Na__LeRaster__Get, Na__LeRaster__Set } from '../20__System__Viewports/Na__LayoutEditor__RasterQuality__.js';
    import { Na__LeMarkup__ImportFromScene } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeClip__IsCopyName } from '../20__System__Viewports/Na__LayoutEditor__ViewportClipboard__.js';
    import { Na__LeScope__WithAdoption } from '../30__System__SheetTools/Na__LayoutEditor__EditScope__.js';   // <-- A viewport added while a group is open joins the group
    import {
        Na__LeDoors__SWINGS_FIELD,
        Na__LeDoors__IsPlan,
        Na__LeDoors__ClosedCount,
        Na__LeDoors__OpenAll,
        Na__LeDoors__SwingsHidden,
        Na__LeDoors__SetSwingsHidden
    } from '../20__System__Viewports/Na__LayoutEditor__PlanDoors__.js';
    import {
        Na__SpStore__CHANGED_EVENT,
        Na__SpStore__STATUS_READY,
        Na__SpStore__STATUS_EMPTY,
        Na__SpStore__Resolve,
        Na__SpStore__GetStatus,
        Na__SpStore__GetDescriptor,
        Na__SpStore__GetFocusBoundsMm,
        Na__SpStore__GetStores,
        Na__SpStore__ResolveAll,
        Na__SpStore__DefaultStoreId
    } from '../21__System__SitePlanData/Na__SitePlan__Store__.js';
    import {
        Na__LeSpComp__PLAN_AUTO,
        Na__LeSpComp__PLAN_BLOCK,
        Na__LeSpComp__PLAN_LOCAL,
        Na__LeSpComp__StoredPlanType,
        Na__LeSpComp__PlanTypeForScale
    } from '../25__System__RenderStyles/Na__LayoutEditor__SitePlanComposites__.js';
    import {
        Na__LeSource__HasChoices,
        Na__LeSource__Resolve,
        Na__LeSource__Options,
        Na__LeSource__SelectValue,
        Na__LeSource__StatusText
    } from '../20__System__Viewports/Na__LayoutEditor__ModelSource__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Scenes and Groups
    // ------------------------------------------------------------
    import { Na__PresentationMode__ProjectJson__GetActiveConfig } from '../../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    import { Na__PresentationMode__SceneGroups__GetEnabledGroups, Na__PresentationMode__SceneGroups__GetScenesInGroup } from '../../21__System__PresentationMode/Na__PresentationMode__SceneGroups__Data__.js';
    import { Na__DrawData__IsFloorPlanScene, Na__DrawData__IsElevationScene, Na__DrawData__SCENE_PLAN_ID_KEY, Na__DrawData__SCENE_ELEVATION_ID_KEY } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__FpData__GetStoreyLevel } from '../../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';   // <-- The storey named in the Doors note when it hides the swings
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id, Scene Keys and the Edit Request Event
    // ------------------------------------------------------------
    const Na__LePanelViewport__ID            = 'viewport';
    const Na__LePanelViewport__SCENES_KEY    = 'PresentationMode__SavedCameraScenes__Scenes';
    const Na__LePanelViewport__EDIT_EVENT    = 'na-layouteditor-request-drawing';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Options
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Every Scene Grouped for a Select
    // ------------------------------------------------------------
    function Na__LePanelViewport__SceneOptions() {
        const config  = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const scenes  = (config && Array.isArray(config[Na__LePanelViewport__SCENES_KEY])) ? config[Na__LePanelViewport__SCENES_KEY] : [];
        const groups  = Na__PresentationMode__SceneGroups__GetEnabledGroups(config);
        const options = [ { value : '', label : Na__LeCfg__GetLabel('ChooseScene', 'Choose a scene...') } ];
        const seen    = new Set();
        const push = (scene, groupName) => {
            if (!scene || !scene.PresentationMode__Scene__Id || seen.has(scene.PresentationMode__Scene__Id)) return;
            seen.add(scene.PresentationMode__Scene__Id);
            const kind = Na__DrawData__IsFloorPlanScene(scene) ? ' (plan)' : (Na__DrawData__IsElevationScene(scene) ? ' (elevation)' : ' (3D)');
            options.push({ value : scene.PresentationMode__Scene__Id, label : (groupName ? groupName + ': ' : '') + (scene.PresentationMode__Scene__Name || scene.PresentationMode__Scene__Id) + kind, group : groupName });
        };
        groups.forEach((group) => {
            Na__PresentationMode__SceneGroups__GetScenesInGroup(scenes, config, group.PresentationMode__Group__Id).forEach((scene) => push(scene, group.PresentationMode__Group__Name));
        });
        scenes.forEach((scene) => push(scene, null));
        return options;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Kind and Drawing Id for a Scene
    // ------------------------------------------------------------
    function Na__LePanelViewport__Describe(sceneId) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const scenes = (config && Array.isArray(config[Na__LePanelViewport__SCENES_KEY])) ? config[Na__LePanelViewport__SCENES_KEY] : [];
        const scene  = scenes.find((s) => s && s.PresentationMode__Scene__Id === sceneId) || null;
        if (!scene) return null;
        if (Na__DrawData__IsFloorPlanScene(scene)) return { scene : scene, kind : Na__LeModel__KIND_2D, drawingId : scene[Na__DrawData__SCENE_PLAN_ID_KEY] };
        if (Na__DrawData__IsElevationScene(scene)) return { scene : scene, kind : Na__LeModel__KIND_2D, drawingId : scene[Na__DrawData__SCENE_ELEVATION_ID_KEY] };
        return { scene : scene, kind : Na__LeModel__KIND_3D, drawingId : null };
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Viewport for a Scene (centred, at the default size)
    // ------------------------------------------------------------
    // modelSourceId is the design phase it draws; empty is the Project Default.
    // ------------------------------------------------------------
    function Na__LePanelViewport__Add(sheet, sceneId, modelSourceId) {
        const described = Na__LePanelViewport__Describe(sceneId);
        if (!sheet || !described) return null;
        const setup    = Na__LeCfg__GetViewportSetup();
        const layout   = Na__LeLayout__Solve(sheet);
        const viewport = Na__LeScope__WithAdoption(sheet, [ 'viewport' ], () => Na__LeModel__CreateViewport(sheet, {   // <-- Added while a group is open, it joins the group, in the same undo step
            kind : described.kind, sceneId : sceneId, drawingId : described.drawingId, modelSourceId : modelSourceId || null,
            rect : Na__LeLayout__DefaultViewportRect(layout, setup.defaultWidthMm, setup.defaultHeightMm)
        }));
        if (viewport && viewport.Viewport__Kind === Na__LeModel__KIND_2D) Na__LeVp2d__CentreOnDrawing(sheet, viewport);
        if (viewport) Na__LeModel__SetSelection({ kind : 'viewport', id : viewport.Viewport__Id });
        return viewport;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Site Plan Viewport (centred on the red line, layers preset for the scale)
    // ------------------------------------------------------------
    // A 1:500 viewport is named Block Plan and a 1:1250 one Location Plan. Every
    // layer whose export does not list the chosen scale starts switched off, so a
    // location plan starts without the trees. Resolves null, with a toast, on a
    // project with no site plan data.
    // ------------------------------------------------------------
    // HELPER FUNCTION | What a Scale Alone Makes a Site Plan Viewport
    // ------------------------------------------------------------
    // One reading of the rule for the whole panel. Before TASK 06 the naming of
    // a new viewport and the Add dropdown each carried their own `>= 1000`,
    // which agreed with the real 1:500 boundary only because no scale between
    // 501 and 999 was on the list.
    // ------------------------------------------------------------
    function Na__LePanelViewport__PlanTypeName(denominator) {
        return Na__LeSpComp__PlanTypeForScale(denominator) === Na__LeSpComp__PLAN_BLOCK
            ? Na__LeCfg__GetLabel('SitePlanBlockPlan', 'Block Plan')
            : Na__LeCfg__GetLabel('SitePlanLocationPlan', 'Location Plan');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Site Plan Subtype Options
    // ------------------------------------------------------------
    // Adam, TASK 06: 'After the site plan dropdown, add a dropdown for the site
    // plan type.' Three entries, not two: Automatic is the honest default and
    // it SAYS WHAT IT RESOLVED TO at this viewport's scale, so nobody has to
    // remember where the 1:500 line falls to know which way a viewport will
    // draw.
    // ------------------------------------------------------------
    function Na__LePanelViewport__PlanTypeOptions(denominator) {
        const block    = Na__LeCfg__GetLabel('SitePlanBlockPlan', 'Block Plan');
        const location = Na__LeCfg__GetLabel('SitePlanLocationPlan', 'Location Plan');
        const resolved = Na__LeSpComp__PlanTypeForScale(denominator) === Na__LeSpComp__PLAN_BLOCK ? block : location;
        return [
            { value : Na__LeSpComp__PLAN_AUTO,  label : Na__LeCfg__GetLabel('SitePlanPlanTypeAuto', 'Automatic') + ' - ' + resolved },
            { value : Na__LeSpComp__PLAN_BLOCK, label : block },
            { value : Na__LeSpComp__PLAN_LOCAL, label : location }
        ];
    }
    // ------------------------------------------------------------


    async function Na__LePanelViewport__AddSitePlan(sheet, denominator, storeId) {
        if (!sheet) return null;
        const store      = storeId || Na__SpStore__DefaultStoreId();
        const descriptor = await Na__SpStore__Resolve(store);
        if (!descriptor) {
            const toast = Na__LePanels__GetContext() ? Na__LePanels__GetContext().showToast : null;
            if (typeof toast === 'function') toast(Na__LeCfg__GetLabel('SitePlanNoData', 'No site plan data for this project.'), true);
            return null;
        }
        const scales = Na__LeScale__ListDenominators(true);
        const scale  = scales.indexOf(denominator) !== -1 ? denominator : scales[0];
        const off    = {};
        descriptor.SitePlan__Layers.forEach((layer) => { if (layer.Layer__VisibleAtScales.indexOf(scale) === -1) off[layer.Layer__CategoryKey] = false; });
        const setup  = Na__LeCfg__GetViewportSetup();
        const layout = Na__LeLayout__Solve(sheet);
        const viewport = Na__LeScope__WithAdoption(sheet, [ 'viewport' ], () => Na__LeModel__CreateViewport(sheet, {   // <-- Added while a group is open, it joins the group, in the same undo step
            kind : Na__LeModel__KIND_2D, sitePlan : { SitePlan__StoreId : store }, scaleDenominator : scale, modelLayers : off,
            name : Na__LePanelViewport__PlanTypeName(scale),                     // <-- The config's own 1:500 rule, not a second threshold written here
            rect : Na__LeLayout__DefaultViewportRect(layout, setup.defaultWidthMm, setup.defaultHeightMm)
        }));
        if (!viewport) return null;
        const bounds = Na__SpStore__GetFocusBoundsMm(store);
        if (bounds) Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { pan : { X : (bounds.MinX + bounds.MaxX) / 2, Y : (bounds.MinY + bounds.MaxY) / 2 } }, true);
        Na__LeModel__SetSelection({ kind : 'viewport', id : viewport.Viewport__Id });
        return viewport;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Site Plan Stores, as Select Options
    // ------------------------------------------------------------
    // Every store is offered, not only the ones with data, so a project that has
    // exported one of them still shows the other and says it is empty rather
    // than hiding it and leaving Adam wondering where it went.
    // ------------------------------------------------------------
    function Na__LePanelViewport__StoreOptions() {
        return Na__SpStore__GetStores().map((store) => ({
            value : store.Store__Id,
            label : store.Store__Available
                ? `${store.Store__Short} (${store.Store__LayerCount})`
                : `${store.Store__Short} - ${Na__LeCfg__GetLabel('SitePlanStoreEmpty', 'not exported')}`
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What the Add Block Says About the Project's Site Plan Data
    // ------------------------------------------------------------
    function Na__LePanelViewport__StoreNote(status) {
        if (status === Na__SpStore__STATUS_EMPTY) return Na__LeCfg__GetLabel('SitePlanNoData', 'No site plan data for this project.');
        if (status !== Na__SpStore__STATUS_READY) return Na__LeCfg__GetLabel('SitePlanLoading', 'Loading site plan data...');

        const ready = Na__SpStore__GetStores().filter((store) => store.Store__Available);
        if (!ready.length) return Na__LeCfg__GetLabel('SitePlanNoData', 'No site plan data for this project.');

        return ready.map((store) => {
            const descriptor = Na__SpStore__GetDescriptor(store.Store__Id);
            return Na__LeCfg__FormatLabel(
                'SitePlanStoreReady',
                '{store}: {count} layer(s), exported {date}.',
                {
                    store : store.Store__Short,
                    count : store.Store__LayerCount,
                    date  : Na__LePanelViewport__ExportDate(descriptor ? descriptor.SitePlan__ExportedIso : null)
                }
            );
        }).join(' ');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Export Time as the Office Writes It (14 Sep 2026, 17:04)
    // ------------------------------------------------------------
    function Na__LePanelViewport__ExportDate(iso) {
        const date = iso ? new Date(iso) : null;
        if (!date || Number.isNaN(date.getTime())) return 'an unknown time';
        return date.toLocaleDateString('en-GB', { day : 'numeric', month : 'short', year : 'numeric' }) + ', ' + date.toLocaleTimeString('en-GB', { hour : '2-digit', minute : '2-digit' });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Controls (both states live in the body; refresh shows one)
    // ------------------------------------------------------------
    function Na__LePanelViewport__Build(body) {
        const editable = Na__LePanels__IsEditable();
        const add = document.createElement('div');
        add.className = 'na-le-block';
        add.setAttribute('data-na-block', 'add');
        // TWO WAYS TO ADD, ONE SHOWN. An architectural sheet adds a viewport of a
        // scene; a site plan sheet adds a site plan viewport at 1:500 or 1:1250.
        const addScene = document.createElement('div');
        addScene.setAttribute('data-na-block', 'add-scene');
        addScene.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('SceneLabel', 'Scene'), Na__LePanels__Select('vp-add-scene', Na__LePanelViewport__SceneOptions(), '')));
        addScene.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ModelSourceLabel', 'Model Source'), Na__LePanels__Select('vp-add-source', Na__LeSource__Options(null), '')));
        if (editable) addScene.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('AddViewport', 'Add Viewport'), 'vp-add', 'na-le-btn--primary'));
        add.appendChild(addScene);
        const addSitePlan = document.createElement('div');
        addSitePlan.setAttribute('data-na-block', 'add-siteplan');
        addSitePlan.hidden = true;
        const sitePlanScales = Na__LeScale__ListDenominators(true).map((d) => ({
            value : d,
            label : Na__LeScale__FormatLabel(d) + ' - ' + Na__LePanelViewport__PlanTypeName(d)
        }));
        addSitePlan.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('SitePlanStoreLabel', 'Site Plan'), Na__LePanels__Select('vp-add-siteplan-store', Na__LePanelViewport__StoreOptions(), '')));
        addSitePlan.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('SitePlanAddScale', 'Scale'), Na__LePanels__Select('vp-add-siteplan-scale', sitePlanScales, '')));
        if (editable) addSitePlan.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('AddSitePlanViewport', 'Add Site Plan Viewport'), 'vp-add-siteplan', 'na-le-btn--primary'));
        const sitePlanNote = Na__LePanels__Note('');
        sitePlanNote.setAttribute('data-na-block', 'siteplan-note');
        addSitePlan.appendChild(sitePlanNote);
        add.appendChild(addSitePlan);
        add.appendChild(Na__LePanels__Note(Na__LeCfg__GetLabel('NoSelection', 'Select a viewport on the sheet.')));
        body.appendChild(add);

        // RASTER | Not a property of this viewport: one working resolution for
        // every picture on every sheet, so it sits outside the edit block and
        // shows whether or not something is selected.
        const raster = Na__LePanels__Select('vp-raster', Na__LeRaster__LEVELS.map((level) => ({
            value : level, label : Na__LeCfg__GetLabel('Raster' + level.charAt(0).toUpperCase() + level.slice(1), level.charAt(0).toUpperCase() + level.slice(1))
        })), Na__LeRaster__Get());
        body.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('RasterGlobal', 'Raster (all sheets)'), raster));
        body.appendChild(Na__LePanels__Note(Na__LeCfg__GetLabel('RasterNote', 'Global working resolution of every viewport picture. The PDF always exports at High.')));

        const edit = document.createElement('div');
        edit.className = 'na-le-block';
        edit.setAttribute('data-na-block', 'edit');
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ViewportName', 'Name'), Na__LePanels__Input('text', 'vp-name', { placeholder : 'Caption from the scene' })));
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('SceneLabel', 'Scene'), Na__LePanels__Select('vp-scene', Na__LePanelViewport__SceneOptions(), '')));
        // MODEL SOURCE | Beside the scene because together they say what is drawn:
        // the scene says from where, the source says which design phase.
        const source = Na__LePanels__Select('vp-source', Na__LeSource__Options(null), '');
        source.title = Na__LeCfg__GetLabel('ModelSourceNote', 'The design phase this viewport draws.');
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ModelSourceLabel', 'Model Source'), source));
        const sourceNote = Na__LePanels__Note('');
        sourceNote.setAttribute('data-na-block', 'source-note');
        sourceNote.hidden = true;
        edit.appendChild(sourceNote);
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('LayerLabel', 'Layer'), Na__LePanels__Select('vp-layer', [], '')));

        const scale = document.createElement('div');
        scale.className = 'na-le-toggle-group na-le-toggle-group--tight';     // <-- Four scales on one line in the default column
        scale.setAttribute('data-na-block', 'scale');
        Na__LeScale__ListDenominators().forEach((d) => scale.appendChild(Na__LePanels__Button(Na__LeScale__FormatLabel(d), 'vp-scale', 'na-le-btn--toggle', d)));
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ScaleLabel', 'Scale'), scale));
        const sitePlanStore = Na__LePanels__Select('vp-siteplan-store', Na__LePanelViewport__StoreOptions(), '');
        sitePlanStore.title = Na__LeCfg__GetLabel('SitePlanStoreNote', 'Which site plan this viewport draws - the Existing one or the Proposed one.');
        const sitePlanStoreRow = Na__LePanels__Row(Na__LeCfg__GetLabel('SitePlanStoreLabel', 'Site Plan'), sitePlanStore);
        sitePlanStoreRow.setAttribute('data-na-block', 'siteplan-store-row');
        edit.appendChild(sitePlanStoreRow);
        const sitePlanType = Na__LePanels__Select('vp-siteplan-type', Na__LePanelViewport__PlanTypeOptions(null), Na__LeSpComp__PLAN_AUTO);
        sitePlanType.title = Na__LeCfg__GetLabel('SitePlanPlanTypeNote', 'Block plan or location plan. A block plan draws the full composite - solid fills, hatch patterns, then the linework. A location plan paints only the proposed fills, no patterns, and greyscales every line but the boundary. Automatic follows the scale: 1:500 or finer is a block plan.');
        const sitePlanTypeRow = Na__LePanels__Row(Na__LeCfg__GetLabel('SitePlanPlanTypeLabel', 'Plan type'), sitePlanType);
        sitePlanTypeRow.setAttribute('data-na-block', 'siteplan-type-row');
        edit.appendChild(sitePlanTypeRow);
        const sitePlanScale = document.createElement('div');                     // <-- A site plan viewport's own toggle: 1:500 and 1:1250
        sitePlanScale.className = 'na-le-toggle-group na-le-toggle-group--tight';
        sitePlanScale.setAttribute('data-na-block', 'scale-siteplan');
        Na__LeScale__ListDenominators(true).forEach((d) => sitePlanScale.appendChild(Na__LePanels__Button(Na__LeScale__FormatLabel(d), 'vp-scale', 'na-le-btn--toggle', d)));
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ScaleLabel', 'Scale'), sitePlanScale));

        const frame = document.createElement('div');
        frame.className = 'na-le-grid4';
        [ 'X', 'Y', 'WidthMm', 'HeightMm' ].forEach((key) => {
            const input = Na__LePanels__Input('number', 'vp-frame', { step : 1 });
            input.setAttribute('data-na-role', key);
            input.title = key;
            frame.appendChild(input);
        });
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('FrameLabel', 'Frame mm'), frame));

        // ROTATION | Degrees clockwise about the middle of the frame, the whole
        // viewport turning - frame, drawing or picture, frame line and caption.
        // Typed to a decimal place, or a quarter turn either way, or back to
        // level. The rotate grip over the frame does the same by hand, Shift
        // holding quarter turns.
        const turn = document.createElement('div');
        turn.className = 'na-le-grid4';
        turn.setAttribute('data-na-block', 'rotation');
        const turnInput = Na__LePanels__Input('number', 'vp-rotation', { step : 'any', min : -180, max : 180 });   // <-- Any decimal typed; the arrows still step by one
        turnInput.title = Na__LeCfg__GetLabel('ViewportRotationTitle', 'Degrees clockwise the whole viewport is turned about the middle of its frame, -180 to 180. Or drag the round grip above the selected frame; hold Shift for quarter turns.');
        turn.appendChild(turnInput);
        if (editable) {
            const left  = Na__LePanels__Button(Na__LeCfg__GetLabel('ViewportRotateLeft', '-90\u00b0'), 'vp-rotate-by', 'na-le-btn--small', '-90');
            const right = Na__LePanels__Button(Na__LeCfg__GetLabel('ViewportRotateRight', '+90\u00b0'), 'vp-rotate-by', 'na-le-btn--small', '90');
            const level = Na__LePanels__Button(Na__LeCfg__GetLabel('ViewportRotateReset', 'Level'), 'vp-rotate-reset', 'na-le-btn--small');
            left.title  = Na__LeCfg__GetLabel('ViewportRotateLeftTitle', 'Turn a quarter turn anticlockwise.');
            right.title = Na__LeCfg__GetLabel('ViewportRotateRightTitle', 'Turn a quarter turn clockwise.');
            level.title = Na__LeCfg__GetLabel('ViewportRotateResetTitle', 'Back to level (0 degrees).');
            turn.appendChild(left);
            turn.appendChild(right);
            turn.appendChild(level);
        }
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ViewportRotationLabel', 'Rotation deg'), turn));

        const pan = document.createElement('div');
        pan.className = 'na-le-grid4';
        pan.setAttribute('data-na-block', 'pan');
        [ 'X', 'Y' ].forEach((key) => { const input = Na__LePanels__Input('number', 'vp-pan', { step : 10 }); input.setAttribute('data-na-role', key); input.title = 'Window centre ' + key; pan.appendChild(input); });
        if (editable) pan.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('CentreOnDrawing', 'Centre'), 'vp-centre', 'na-le-btn--small'));
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('PanLabel', 'Window mm'), pan));

        // ZOOM | 3D only: how large the picture is drawn in its frame. A 2D
        // viewport's size on the paper is its scale, so it has no zoom of its own.
        const zoomSetup = Na__LeCfg__GetViewportSetup();
        const zoom      = document.createElement('div');
        zoom.className = 'na-le-grid4';
        zoom.setAttribute('data-na-block', 'zoom');
        const zoomInput = Na__LePanels__Input('number', 'vp-zoom', { step : 'any', min : Math.round(zoomSetup.imageZoomMin * 100), max : Math.round(zoomSetup.imageZoomMax * 100) });   // <-- Any decimal typed; the arrows still step by one
        zoomInput.title = Na__LeCfg__GetLabel('ZoomTitle', 'How large the 3D picture is drawn in its frame, as a percentage of its size before zooming. Type any value, to a decimal place. Or double-click the viewport and scroll over it to zoom about the cursor.');
        zoom.appendChild(zoomInput);
        if (editable) {
            const zoomReset = Na__LePanels__Button(Na__LeCfg__GetLabel('ZoomReset', 'Reset'), 'vp-zoom-reset', 'na-le-btn--small');
            zoomReset.title = Na__LeCfg__GetLabel('ZoomResetTitle', 'Back to 100%, centred in the frame.');
            zoom.appendChild(zoomReset);
        }
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ZoomLabel', 'Zoom %'), zoom));

        const markup = document.createElement('div');
        markup.className = 'na-le-toggle-group';
        markup.setAttribute('data-na-block', 'markup');
        markup.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('MarkupScene', 'Scene'), 'vp-markup', 'na-le-btn--toggle', 'scene'));
        markup.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('MarkupSheet', 'Sheet'), 'vp-markup', 'na-le-btn--toggle', 'sheet'));
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('MarkupMode', 'Markup'), markup));
        // FRAME | The border and caption round the viewport, on the sheet and in
        // the PDF. It sits above Caption because the caption rides on the frame.
        const frameRow = Na__LePanels__Row(Na__LeCfg__GetLabel('ShowFrameLabel', 'Frame'), Na__LePanels__Input('checkbox', 'vp-show-frame'));
        frameRow.title = Na__LeCfg__GetLabel('ShowFrameTitle', 'The border and caption round this viewport, on the sheet and in the PDF. Untick once the sheet is set out, to title the view yourself.');
        edit.appendChild(frameRow);
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('ShowScaleLabel', 'Caption'), Na__LePanels__Input('checkbox', 'vp-caption')));
        edit.appendChild(Na__LePanels__Row(Na__LeCfg__GetLabel('LockedLabel', 'Locked'), Na__LePanels__Input('checkbox', 'vp-locked')));
        // DOORS | Plans only. A plan draws every door open; the note says how many
        // this viewport has shut. A div rather than the label row, so a click on
        // the caption can never press Open all.
        const doorsRow = document.createElement('div');
        doorsRow.className = 'na-le-row';
        doorsRow.setAttribute('data-na-block', 'doors');
        const doorsCaption = document.createElement('span');
        doorsCaption.className   = 'na-le-row__label';
        doorsCaption.textContent = Na__LeCfg__GetLabel('DoorsLabel', 'Doors');
        doorsRow.appendChild(doorsCaption);
        if (editable) doorsRow.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('DoorsOpenAll', 'Open all'), 'vp-doors-open-all', 'na-le-btn--small'));
        // HIDE SWINGS | Beside Open all, on the row where the doors are set:
        // every door swing left off this plan. A roof plan starts ticked. Its
        // own small label round the box and its words, so a click on either
        // ticks it and a click on the row's caption still does nothing.
        const hideSwings = document.createElement('label');
        hideSwings.className = 'na-le-row__inline-check';
        hideSwings.setAttribute('data-na-block', 'hide-swings');
        hideSwings.title = Na__LeCfg__GetLabel('DoorsHideSwingsTitle', 'Leave every door swing off this plan - the arcs and any door swing linework - on the sheet and in the PDF. The doors still draw open and still close with a click. A roof plan starts with it ticked.');
        hideSwings.appendChild(Na__LePanels__Input('checkbox', 'vp-hide-swings'));
        const hideSwingsText = document.createElement('span');
        hideSwingsText.textContent = Na__LeCfg__GetLabel('DoorsHideSwings', 'Hide swings');
        hideSwings.appendChild(hideSwingsText);
        doorsRow.appendChild(hideSwings);
        edit.appendChild(doorsRow);
        const doorsNote = Na__LePanels__Note('');
        doorsNote.setAttribute('data-na-block', 'doors-note');
        edit.appendChild(doorsNote);

        if (editable) {
            const actions = document.createElement('div');
            actions.className = 'na-le-bar';
            actions.setAttribute('data-na-block', 'actions2d');
            actions.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('ImportFromScene', 'Import From Scene'), 'vp-import', ''));
            actions.appendChild(Na__LePanels__Button(Na__LeCfg__GetLabel('EditInDrawing', 'Edit In Drawing'), 'vp-edit', ''));
            edit.appendChild(actions);
        }
        body.appendChild(edit);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelViewport__Refresh(body) {
        const rasterSelect = body.querySelector('[data-na-control="vp-raster"]');
        if (rasterSelect && document.activeElement !== rasterSelect) rasterSelect.value = Na__LeRaster__Get();
        const sheet    = Na__LeModel__GetActiveSheet();
        const viewport = Na__LeModel__GetSelectedViewport();
        const addBlock = body.querySelector('[data-na-block="add"]');
        const editBlock = body.querySelector('[data-na-block="edit"]');
        addBlock.hidden  = !!viewport;
        editBlock.hidden = !viewport;
        // SITE PLAN SHEET | Add offers the site plan scales and says what data there is
        const sitePlanSheet = !!sheet && Na__LeModel__IsSitePlanSheet(sheet);
        const addScene      = addBlock.querySelector('[data-na-block="add-scene"]');
        const addSitePlan   = addBlock.querySelector('[data-na-block="add-siteplan"]');
        if (addScene)    addScene.hidden    = sitePlanSheet;
        if (addSitePlan) addSitePlan.hidden = !sitePlanSheet;
        if (sitePlanSheet) {
            const status = Na__SpStore__GetStatus();                             // <-- Across every store
            const note   = addBlock.querySelector('[data-na-block="siteplan-note"]');
            const button = addBlock.querySelector('[data-na-control="vp-add-siteplan"]');
            const store  = addBlock.querySelector('[data-na-control="vp-add-siteplan-store"]');
            // The stores resolve AFTER this panel first builds, so on the first
            // pass nothing is available and the default falls back to proposed.
            // Left alone the select would latch onto that and go on offering an
            // empty store even once the real one has loaded. Keep the choice
            // only while it still names a store that has data.
            if (store) {
                const stores = Na__SpStore__GetStores();
                const chosen = stores.find((entry) => entry.Store__Id === store.value);
                const keep   = chosen && chosen.Store__Available;
                Na__LePanels__FillSelect(store, Na__LePanelViewport__StoreOptions(),
                    keep ? store.value : Na__SpStore__DefaultStoreId());
            }
            if (note) note.textContent = Na__LePanelViewport__StoreNote(status);
            if (button) button.disabled = status !== Na__SpStore__STATUS_READY;
            if (status !== Na__SpStore__STATUS_READY && status !== Na__SpStore__STATUS_EMPTY) Na__SpStore__ResolveAll();   // <-- The store's event refreshes this panel when it lands
        }
        const addSelect = addBlock.querySelector('[data-na-control="vp-add-scene"]');
        if (addSelect && addSelect.options.length <= 1) Na__LePanels__FillSelect(addSelect, Na__LePanelViewport__SceneOptions(), '');
        // THE SOURCE CHOICES ARRIVE WITH THE PROJECT DATA, which can be after the
        // panel was built, so both selects refill whenever the count differs. The
        // row is hidden outright on a project with one model: no choice to make.
        const choices   = Na__LeSource__HasChoices();
        const addSource = addBlock.querySelector('[data-na-control="vp-add-source"]');
        if (addSource) {
            addSource.parentNode.hidden = !choices;
            const options = Na__LeSource__Options(null);
            if (addSource.options.length !== options.length && document.activeElement !== addSource) Na__LePanels__FillSelect(addSource, options, addSource.value);
        }
        if (!viewport || !sheet) return;

        const is2d = viewport.Viewport__Kind === Na__LeModel__KIND_2D;
        const isSitePlan = Na__LeModel__IsSitePlanViewport(viewport);             // <-- No scene, model source, markup or scene actions
        const set  = (name, value) => { const el = editBlock.querySelector('[data-na-control="' + name + '"]'); if (el && document.activeElement !== el) el.value = value; };
        set('vp-name', viewport.Viewport__Name || '');
        const sceneSelect = editBlock.querySelector('[data-na-control="vp-scene"]');
        Na__LePanels__FillSelect(sceneSelect, Na__LePanelViewport__SceneOptions(), viewport.Viewport__SceneId || '');
        sceneSelect.parentNode.hidden = isSitePlan;
        const sourceSelect = editBlock.querySelector('[data-na-control="vp-source"]');
        if (sourceSelect) {
            sourceSelect.parentNode.hidden = !choices || isSitePlan;
            if (document.activeElement !== sourceSelect) Na__LePanels__FillSelect(sourceSelect, Na__LeSource__Options(viewport), Na__LeSource__SelectValue(viewport));
        }
        const sourceNote = editBlock.querySelector('[data-na-block="source-note"]');
        if (sourceNote) {
            const source = Na__LeSource__Resolve(viewport);
            const text   = source.missing
                ? Na__LeCfg__FormatLabel('ModelSourceMissing', '"{id}" is not a design phase of this project, so this viewport draws the Project Default.', { id : source.storedId })
                : ((source.renderId && source.status !== 'ready') ? Na__LeSource__StatusText(source) : '');
            sourceNote.textContent = text;
            sourceNote.hidden = !choices || !text || isSitePlan;
        }
        Na__LePanels__FillSelect(editBlock.querySelector('[data-na-control="vp-layer"]'), Na__LeModel__GetLayers(sheet).map((l) => ({ value : l.Layer__Id, label : l.Layer__Name })), viewport.Viewport__LayerId);

        editBlock.querySelector('[data-na-block="scale"]').parentNode.hidden = !is2d || isSitePlan;
        editBlock.querySelector('[data-na-block="scale-siteplan"]').parentNode.hidden = !isSitePlan;
        const storeRow = editBlock.querySelector('[data-na-block="siteplan-store-row"]');
        if (storeRow) {
            storeRow.hidden = !isSitePlan;
            if (isSitePlan) {
                const stored = (viewport.Viewport__SitePlan && viewport.Viewport__SitePlan.SitePlan__StoreId) || Na__SpStore__DefaultStoreId();
                Na__LePanels__FillSelect(storeRow.querySelector('[data-na-control="vp-siteplan-store"]'), Na__LePanelViewport__StoreOptions(), stored);
            }
        }
        const typeRow = editBlock.querySelector('[data-na-block="siteplan-type-row"]');
        if (typeRow) {
            typeRow.hidden = !isSitePlan;
            // REBUILT EVERY REFRESH, not just filled: the Automatic entry names
            // what the CURRENT scale resolves to, so changing the scale has to
            // change the wording of the option that is already selected.
            if (isSitePlan) {
                Na__LePanels__FillSelect(
                    typeRow.querySelector('[data-na-control="vp-siteplan-type"]'),
                    Na__LePanelViewport__PlanTypeOptions(viewport.Viewport__ScaleDenominator),
                    Na__LeSpComp__StoredPlanType(viewport)
                );
            }
        }
        editBlock.querySelectorAll('[data-na-control="vp-scale"]').forEach((b) => b.classList.toggle('na-le-btn--active', parseFloat(b.getAttribute('data-na-role')) === viewport.Viewport__ScaleDenominator));
        editBlock.querySelectorAll('[data-na-control="vp-frame"]').forEach((input) => {
            if (document.activeElement !== input) input.value = String(Math.round(viewport.Viewport__FrameMm[input.getAttribute('data-na-role')] * 10) / 10);
        });
        const turnBlock = editBlock.querySelector('[data-na-block="rotation"]');
        if (turnBlock) {
            const turnLocked = viewport.Viewport__Locked === true || Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId);   // <-- A lock holds the turn as it holds the frame
            const turnInput  = turnBlock.querySelector('[data-na-control="vp-rotation"]');
            if (turnInput) {
                if (document.activeElement !== turnInput) turnInput.value = String(Math.round(Na__LeVpRot__Deg(viewport) * 10) / 10);   // <-- A tenth of a degree is as fine as the box needs to read
                turnInput.disabled = !Na__LePanels__IsEditable() || turnLocked;
            }
            turnBlock.querySelectorAll('[data-na-control="vp-rotate-by"], [data-na-control="vp-rotate-reset"]').forEach((b) => { b.disabled = !Na__LePanels__IsEditable() || turnLocked; });
        }
        editBlock.querySelector('[data-na-block="pan"]').parentNode.hidden = !is2d;
        editBlock.querySelectorAll('[data-na-control="vp-pan"]').forEach((input) => {
            if (document.activeElement !== input) input.value = String(Math.round(viewport.Viewport__PanMm[input.getAttribute('data-na-role')]));
        });
        const zoomBlock = editBlock.querySelector('[data-na-block="zoom"]');
        if (zoomBlock) {
            const zoomLocked = viewport.Viewport__Locked === true || Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId);   // <-- A lock holds the framing as well as the frame
            zoomBlock.parentNode.hidden = is2d;
            const zoomInput = zoomBlock.querySelector('[data-na-control="vp-zoom"]');
            if (zoomInput) {
                if (document.activeElement !== zoomInput) zoomInput.value = String(Na__LeVpZoom__Percent(Na__LeVpZoom__Get(viewport)));
                zoomInput.disabled = !Na__LePanels__IsEditable() || zoomLocked;
            }
            const zoomReset = zoomBlock.querySelector('[data-na-control="vp-zoom-reset"]');
            if (zoomReset) zoomReset.disabled = !Na__LePanels__IsEditable() || zoomLocked;
        }
        editBlock.querySelector('[data-na-block="markup"]').parentNode.hidden = !is2d || isSitePlan;
        editBlock.querySelectorAll('[data-na-control="vp-markup"]').forEach((b) => b.classList.toggle('na-le-btn--active', b.getAttribute('data-na-role') === viewport.Viewport__MarkupMode));
        const frameShown = viewport.Viewport__ShowFrame !== false;
        const showFrame  = editBlock.querySelector('[data-na-control="vp-show-frame"]');
        if (showFrame) showFrame.checked = frameShown;
        const caption = editBlock.querySelector('[data-na-control="vp-caption"]');
        if (caption) {
            caption.checked  = viewport.Viewport__ShowScaleLabel !== false;
            caption.disabled = !Na__LePanels__IsEditable() || !frameShown;       // <-- Its own setting is kept, and applies again when the frame comes back
            caption.parentNode.title = frameShown ? '' : Na__LeCfg__GetLabel('CaptionNeedsFrame', 'The caption shows with the frame. Tick Frame to show it.');
        }
        const locked = editBlock.querySelector('[data-na-control="vp-locked"]');
        if (locked) locked.checked = viewport.Viewport__Locked === true;
        const isPlan    = Na__LeDoors__IsPlan(viewport);
        const shutCount = isPlan ? Na__LeDoors__ClosedCount(viewport) : 0;
        const doorsRow  = editBlock.querySelector('[data-na-block="doors"]');
        if (doorsRow) doorsRow.hidden = !isPlan;
        const openAll = editBlock.querySelector('[data-na-control="vp-doors-open-all"]');
        if (openAll) openAll.disabled = !Na__LePanels__IsEditable() || shutCount === 0;   // <-- A lock holds the frame, not the doors
        // HIDE SWINGS | The tick, or the plan's storey while nobody has ticked:
        // a roof plan reads ticked, and the note says why.
        const plan         = isPlan ? Na__LeModel__ResolveViewportSource(viewport).plan : null;
        const swingsHidden = isPlan && Na__LeDoors__SwingsHidden(viewport, plan);
        const byStorey     = swingsHidden && typeof viewport[Na__LeDoors__SWINGS_FIELD] !== 'boolean';
        const hideSwings   = editBlock.querySelector('[data-na-control="vp-hide-swings"]');
        if (hideSwings) {
            hideSwings.checked  = swingsHidden;
            hideSwings.disabled = !Na__LePanels__IsEditable();                   // <-- A lock holds the frame, not the doors
        }
        const doorsNote = editBlock.querySelector('[data-na-block="doors-note"]');
        if (doorsNote) {
            const storey = byStorey ? Na__FpData__GetStoreyLevel(plan) : null;
            doorsNote.hidden      = !isPlan;
            doorsNote.textContent = (shutCount === 0
                ? Na__LeCfg__GetLabel('DoorsAllOpen', 'Every door is drawn open. With the viewport selected, click a door on the plan to close it.')
                : Na__LeCfg__FormatLabel('DoorsSomeClosed', '{count} closed. Click a door on the plan to open or close it.', { count : shutCount }))
                + (byStorey ? ' ' + Na__LeCfg__FormatLabel('DoorsSwingsHiddenByStorey', 'Swings are hidden by default on a {storey}.', { storey : storey ? storey.label.toLowerCase() : 'roof plan' }) : '');
        }
        const actions = editBlock.querySelector('[data-na-block="actions2d"]');
        if (actions) actions.hidden = !is2d || isSitePlan;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected Viewport With Its Sheet, or Nothing
    // ------------------------------------------------------------
    function Na__LePanelViewport__Current() {
        const sheet = Na__LeModel__GetActiveSheet();
        const viewport = Na__LeModel__GetSelectedViewport();
        return (sheet && viewport) ? { sheet : sheet, viewport : viewport } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelViewport__Register() {
        Na__LePanels__OnControl('change', 'vp-raster', (e, el) => Na__LeRaster__Set(el.value));
        Na__LePanels__OnControl('click', 'vp-add', (e, el) => {
            const select = el.parentNode.querySelector('[data-na-control="vp-add-scene"]');
            const source = el.parentNode.querySelector('[data-na-control="vp-add-source"]');
            const sheet  = Na__LeModel__GetActiveSheet();
            if (select && select.value && sheet) Na__LePanelViewport__Add(sheet, select.value, source ? source.value : null);
        });
        Na__LePanels__OnControl('click', 'vp-add-siteplan', (e, el) => {
            const select = el.parentNode.querySelector('[data-na-control="vp-add-siteplan-scale"]');
            const store  = el.parentNode.querySelector('[data-na-control="vp-add-siteplan-store"]');
            const sheet  = Na__LeModel__GetActiveSheet();
            if (sheet) Na__LePanelViewport__AddSitePlan(sheet, select ? parseFloat(select.value) : NaN, store ? store.value : '');
        });
        Na__LePanels__OnControl('change', 'vp-siteplan-type', (e, el) => {
            const c = Na__LePanelViewport__Current();
            if (!c || !Na__LeModel__IsSitePlanViewport(c.viewport)) return;
            if (Na__LeSpComp__StoredPlanType(c.viewport) === el.value) return;
            // Automatic is stored as nothing at all, so the record layer drops
            // the key and a viewport on the default stays byte-identical.
            const next = (el.value === Na__LeSpComp__PLAN_BLOCK || el.value === Na__LeSpComp__PLAN_LOCAL) ? el.value : '';
            Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { sitePlanPlanType : next });
        });
        Na__LePanels__OnControl('change', 'vp-siteplan-store', (e, el) => {
            const c = Na__LePanelViewport__Current();
            if (!c || !Na__LeModel__IsSitePlanViewport(c.viewport)) return;
            const block = c.viewport.Viewport__SitePlan || {};
            if ((block.SitePlan__StoreId || '') === el.value) return;
            Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { sitePlanStoreId : el.value });   // <-- One undo step; the token changes so the frame repaints from the other store
        });
        window.addEventListener(Na__SpStore__CHANGED_EVENT, (event) => {
            if (!event.detail || event.detail.reason !== 'layer-loaded') Na__LePanels__Refresh(Na__LePanelViewport__ID);   // <-- The add note and button follow the site plan data
        });
        Na__LePanels__OnControl('change', 'vp-source', (e, el) => {
            const c = Na__LePanelViewport__Current();
            if (!c) return;
            const next = el.value || null;
            if ((c.viewport.Viewport__ModelSourceId || null) === next) return;
            Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { modelSourceId : next });   // <-- One undo step; the frame redraws from the new phase
        });
        Na__LePanels__OnControl('change', 'vp-name',  (e, el) => { const c = Na__LePanelViewport__Current(); if (c) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { name : el.value.trim() }); });
        Na__LePanels__OnControl('change', 'vp-layer', (e, el) => { const c = Na__LePanelViewport__Current(); if (c) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { layerId : el.value }); });
        Na__LePanels__OnControl('change', 'vp-scene', (e, el) => {
            const c = Na__LePanelViewport__Current();
            const d = Na__LePanelViewport__Describe(el.value);
            if (!c || !d || Na__LeModel__IsSitePlanViewport(c.viewport)) return;   // <-- A site plan viewport has no scene
            const patch = { sceneId : el.value, drawingId : d.drawingId, kind : d.kind, snapshotAsset : null };
            if (Na__LeClip__IsCopyName(c.viewport)) patch.name = '';                  // <-- A pasted copy's placeholder name described the old scene: the caption follows the new one
            Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, patch);
            if (d.kind === Na__LeModel__KIND_2D) Na__LeVp2d__CentreOnDrawing(c.sheet, c.viewport);
        });
        Na__LePanels__OnControl('click', 'vp-scale', (e, el, role) => { const c = Na__LePanelViewport__Current(); if (c) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { scaleDenominator : parseFloat(role) }); });
        Na__LePanels__OnControl('change', 'vp-frame', (e, el, key) => {
            const c = Na__LePanelViewport__Current(); const v = parseFloat(el.value);
            if (c && Number.isFinite(v)) { const rect = {}; rect[key] = v; Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { rect : rect }); }
        });
        Na__LePanels__OnControl('change', 'vp-rotation', (e, el) => {
            const c = Na__LePanelViewport__Current(); const v = parseFloat(el.value);
            if (!c) return;
            if (!Number.isFinite(v)) { el.value = String(Math.round(Na__LeVpRot__Deg(c.viewport) * 10) / 10); return; }   // <-- Not an angle: the box shows the turn the viewport has
            const to = Na__LeVpRot__WrapDeg(v);
            if (to !== Na__LeVpRot__Deg(c.viewport)) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { rotationDeg : to });   // <-- About the middle of the frame; one undo step
            el.value = String(Math.round(Na__LeVpRot__Deg(c.viewport) * 10) / 10);   // <-- 270 reads back as -90: the angle wrapped
        });
        Na__LePanels__OnControl('click', 'vp-rotate-by', (e, el, role) => {
            const c = Na__LePanelViewport__Current(); const by = parseFloat(role);
            if (c && Number.isFinite(by)) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { rotationDeg : Na__LeVpRot__WrapDeg(Na__LeVpRot__Deg(c.viewport) + by) });
        });
        Na__LePanels__OnControl('click', 'vp-rotate-reset', () => {
            const c = Na__LePanelViewport__Current();
            if (c && Na__LeVpRot__Deg(c.viewport) !== 0) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { rotationDeg : 0 });
        });
        Na__LePanels__OnControl('change', 'vp-pan', (e, el, key) => {
            const c = Na__LePanelViewport__Current(); const v = parseFloat(el.value);
            if (c && Number.isFinite(v)) { const pan = {}; pan[key] = v; Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { pan : pan }); }
        });
        Na__LePanels__OnControl('click', 'vp-centre', () => { const c = Na__LePanelViewport__Current(); if (c && Na__LeVp2d__CentreOnDrawing(c.sheet, c.viewport)) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, {}, false); });
        Na__LePanels__OnControl('change', 'vp-zoom', (e, el) => {
            const c = Na__LePanelViewport__Current();
            if (!c || c.viewport.Viewport__Kind !== Na__LeModel__KIND_3D) return;
            const percent = parseFloat(el.value);
            const patch   = (Number.isFinite(percent) && percent > 0) ? Na__LeVpZoom__PatchAbout(c.viewport, percent / 100, null) : null;
            if (!patch) { el.value = String(Na__LeVpZoom__Percent(Na__LeVpZoom__Get(c.viewport))); return; }   // <-- Not a zoom: the box shows the one the picture has
            Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, patch);                                // <-- About the middle of the frame; one undo step
            el.value = String(Na__LeVpZoom__Percent(Na__LeVpZoom__Get(c.viewport)));                             // <-- A value past a limit shows the limit it was held to
        });
        Na__LePanels__OnControl('click', 'vp-zoom-reset', () => {
            const c = Na__LePanelViewport__Current();
            if (c && c.viewport.Viewport__Kind === Na__LeModel__KIND_3D) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, Na__LeVpZoom__PatchReset(c.viewport));
        });
        Na__LePanels__OnControl('click', 'vp-markup', (e, el, role) => { const c = Na__LePanelViewport__Current(); if (c) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { markupMode : role }); });
        Na__LePanels__OnControl('change', 'vp-show-frame', (e, el) => { const c = Na__LePanelViewport__Current(); if (c) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { showFrame : el.checked }); });
        Na__LePanels__OnControl('change', 'vp-caption', (e, el) => { const c = Na__LePanelViewport__Current(); if (c) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { showScaleLabel : el.checked }); });
        Na__LePanels__OnControl('change', 'vp-locked',  (e, el) => { const c = Na__LePanelViewport__Current(); if (c) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { locked : el.checked }); });
        Na__LePanels__OnControl('click', 'vp-doors-open-all', () => { const c = Na__LePanelViewport__Current(); if (c) Na__LeDoors__OpenAll(c.sheet, c.viewport.Viewport__Id); });
        Na__LePanels__OnControl('change', 'vp-hide-swings', (e, el) => {
            const c = Na__LePanelViewport__Current();
            if (!c) return;
            if (!Na__LeDoors__SetSwingsHidden(c.sheet, c.viewport.Viewport__Id, el.checked)) el.checked = Na__LeDoors__SwingsHidden(c.viewport);   // <-- One undo step; nothing changed, the box shows what the plan draws
        });
        Na__LePanels__OnControl('click', 'vp-import', () => {
            const c = Na__LePanelViewport__Current();
            if (!c || c.viewport.Viewport__Kind !== Na__LeModel__KIND_2D || Na__LeModel__IsSitePlanViewport(c.viewport)) return;
            const count = Na__LeMarkup__ImportFromScene(c.sheet, c.viewport, Na__LeModel__DefaultLayerId(c.sheet, 'annotation'), Na__LeVp2d__Describe(c.viewport));
            const toast = Na__LePanels__GetContext() ? Na__LePanels__GetContext().showToast : null;
            if (typeof toast === 'function') toast(count + ' item(s) copied from the scene.', false);
            if (count > 0) Na__LeModel__UpdateViewport(c.sheet, c.viewport.Viewport__Id, { markupMode : 'sheet' });
        });
        Na__LePanels__OnControl('click', 'vp-edit', () => {
            const c = Na__LePanelViewport__Current();
            if (!c) return;
            const source = Na__LeModel__ResolveViewportSource(c.viewport);
            window.dispatchEvent(new CustomEvent(Na__LePanelViewport__EDIT_EVENT, { detail : { viewportId : c.viewport.Viewport__Id, plan : source.plan, elevation : source.elevation } }));
        });
        return Na__LePanels__RegisterSection('right', {
            id : Na__LePanelViewport__ID, title : Na__LeCfg__GetLabel('ViewportTitle', 'Viewport'),
            build : Na__LePanelViewport__Build, refresh : Na__LePanelViewport__Refresh
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Viewport Settings Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelViewport__EDIT_EVENT,
        Na__LePanelViewport__Register,
        Na__LePanelViewport__Add,
        Na__LePanelViewport__AddSitePlan
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
