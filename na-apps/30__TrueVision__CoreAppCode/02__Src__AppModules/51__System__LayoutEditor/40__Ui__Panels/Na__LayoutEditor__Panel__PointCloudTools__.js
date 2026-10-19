// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PANEL: POINT CLOUD TOOLS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Panel__PointCloudTools__.js
// NAMESPACE  : Na__LePanelPc
// MODULE     : Layout Editor - Panel Point Cloud Tools
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Lay the point cloud scenes exported from SketchUp over 2D viewports, and set how each one draws
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - Adam: 'Create a new dropdown on the bottom right side of the right hand
//   menu ... call it Point Cloud Tools.' It does three things:
//   - THE SELECTED VIEWPORT. A plan, elevation, section or site plan viewport
//     takes a point cloud scene: its opacity, Linework On Top (the point cloud
//     is on top by default), SketchUp Sync (on by default; off pins the
//     viewport to the export it shows now, so later exports leave it alone),
//     Show Datum and Show Point Cloud. The line under them says whether the
//     scene and the drawing look the same way, which export is drawn, and
//     what the dot size will print at.
//   - THE EXPORTED SCENES. Every active scene, what it is and when it was
//     exported, which TrueVision drawing it lays on, and Add Viewport: a new
//     2D viewport of that drawing at the nearest scale on the list, with the
//     point cloud attached and centred on it.
//   - RELOAD. The exports are read once per session; a new export from
//     SketchUp is picked up by Reload Exports (or Force Render), never by
//     polling.
// - SHOWN ONLY WHERE IT MEANS SOMETHING: when the project has point cloud
//   exports, or the selected viewport carries a scene. A project without a
//   survey never sees it.
// - Also the one place that tells the point cloud layer the paper's zoom
//   (ZOOM_SETTLED_EVENT), so it swaps the preview for the tiles when the
//   paper is zoomed in far enough to need them. The layer cannot listen
//   itself: the sheet surface imports it.
//
// INTEGRATION:
// - Registered into the RIGHT column LAST, after Floor Areas.
// - Writes through Na__LeModel__UpdateViewport's pointCloud patch and
//   Na__LeModel__CreateViewport's pointCloud option; reads the layer's
//   Na__LeVp2d__PointCloudResolve, so the panel and the frame never disagree.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : none (TrueVision only: point cloud viewports)
// - Parity        : n/a
// - Divergences   : n/a
// - Back-port     : goes to ValeVision3D with the point cloud feature, only on Adam's say so
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (point cloud viewports).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Scale, Layout, Scope and the Surface's Zoom
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__GetViewportSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__KIND_2D,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSelectedViewport,
        Na__LeModel__IsSitePlanViewport,
        Na__LeModel__IsPointCloudViewport,
        Na__LeModel__CreateViewport,
        Na__LeModel__UpdateViewport,
        Na__LeModel__SetSelection
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeScale__ListDenominators } from '../07__Core__SheetData/Na__LayoutEditor__ScaleManager__.js';
    import { Na__LeLayout__Solve, Na__LeLayout__DefaultViewportRect } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeScope__WithAdoption } from '../30__System__SheetTools/Na__LayoutEditor__EditScope__.js';   // <-- A viewport added while a group is open joins the group
    import { Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The 2D Viewport's Point Cloud Layer
    // ------------------------------------------------------------
    import {
        Na__LeVp2d__Describe,
        Na__LeVp2d__PC_HIDDEN,
        Na__LeVp2d__PC_MISALIGNED,
        Na__LeVp2d__PC_READY,
        Na__LeVp2d__PointCloudResolve,
        Na__LeVp2d__PointCloudRefreshAll,
        Na__LeVp2d__PointCloudSetZoom,
        Na__LeVp2d__PointCloudReload
    } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Point Cloud Data
    // ------------------------------------------------------------
    import {
        Na__PcStore__CHANGED_EVENT,
        Na__PcStore__STATUS_READY,
        Na__PcStore__STATUS_EMPTY,
        Na__PcStore__STATUS_LOADING,
        Na__PcStore__Resolve,
        Na__PcStore__LoadRevision,
        Na__PcStore__GetStatus,
        Na__PcStore__GetNote,
        Na__PcStore__GetDescriptor,
        Na__PcStore__GetScenes,
        Na__PcStore__GetScene,
        Na__PcStore__GetRevision,
        Na__PcStore__GetRevisionNote,
        Na__PcStore__IsTopDown,
        Na__PcStore__IsFacing
    } from '../22__System__PointCloudData/Na__PointCloud__Store__.js';
    import {
        Na__PcPlace__SitePlanAxes,
        Na__PcPlace__IsOrthoFrame,
        Na__PcPlace__AlignmentDeg,
        Na__PcPlace__Matrix,
        Na__PcPlace__BoundsMm
    } from '../22__System__PointCloudData/Na__PointCloud__Placement__.js';
    import { Na__PcCfg__Ready, Na__PcCfg__Alignment } from '../22__System__PointCloudData/Na__PointCloud__Config__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Records and Scenes
    // ------------------------------------------------------------
    import { Na__FpData__GetFloorPlans } from '../../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';
    import { Na__ElevData__GetElevations, Na__ElevData__GetAxes, Na__ElevData__IsSection } from '../../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js';
    import { Na__PresentationMode__ProjectJson__GetActiveConfig } from '../../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Panel Host
    // ------------------------------------------------------------
    import {
        Na__LePanels__RegisterSection,
        Na__LePanels__SetSectionVisible,
        Na__LePanels__OnControl,
        Na__LePanels__Row,
        Na__LePanels__Input,
        Na__LePanels__Select,
        Na__LePanels__FillSelect,
        Na__LePanels__Button,
        Na__LePanels__Note,
        Na__LePanels__SliderRow,
        Na__LePanels__ShowSlider,
        Na__LePanels__Refresh,
        Na__LePanels__IsEditable
    } from './Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Section Id, Scene Key and Toggle Roles
    // ------------------------------------------------------------
    const Na__LePanelPc__ID         = 'point-cloud-tools';
    const Na__LePanelPc__SCENES_KEY = 'PresentationMode__SavedCameraScenes__Scenes';
    const Na__LePanelPc__TOGGLES    = [
        { role : 'visible',       label : 'Show Point Cloud', labelKey : 'PointCloudShow' },
        { role : 'lineworkOnTop', label : 'Linework On Top',  labelKey : 'PointCloudLineworkOnTop' },
        { role : 'sync',          label : 'SketchUp Sync',    labelKey : 'PointCloudSync' },
        { role : 'datum',         label : 'Show Datum',       labelKey : 'PointCloudShowDatum' }
    ];
    const Na__LePanelPc__TOGGLE_HINTS = {
        visible       : 'Untick to keep the scene attached without drawing it.',
        lineworkOnTop : 'Ticked, the linework is drawn over the point cloud. Unticked, the point cloud is drawn over the linework.',
        sync          : 'Ticked, the viewport follows every new export of this scene. Unticked, it keeps the export it shows now.',
        datum         : 'The survey datum benchmark from SketchUp, in red, over the drawing.'
    };
    // ------------------------------------------------------------

    // MODULE VARIABLES | Wiring, Done Once
    // ------------------------------------------------------------
    let Na__LePanelPc__Wired  = false;
    let Na__LePanelPc__IdSeed = 0;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Label, From the Config When It Names One
    // ------------------------------------------------------------
    function Na__LePanelPc__Label(key, fallback) {
        return Na__LeCfg__GetLabel(key, fallback);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected 2D Viewport, or null
    // ------------------------------------------------------------
    function Na__LePanelPc__Selected() {
        const viewport = Na__LeModel__GetSelectedViewport();
        return (viewport && viewport.Viewport__Kind === Na__LeModel__KIND_2D) ? viewport : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Export Time as "19 Oct 2026 12:39" (the time as SketchUp wrote it, no parsing)
    // ------------------------------------------------------------
    function Na__LePanelPc__When(iso) {
        const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso || ''));
        if (!match) return '';
        const months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
        return parseInt(match[3], 10) + ' ' + (months[parseInt(match[2], 10) - 1] || match[2]) + ' ' + match[1] + ' ' + match[4] + ':' + match[5];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Degree Figure for a Sentence
    // ------------------------------------------------------------
    function Na__LePanelPc__Deg(value) {
        return (Math.round(value * 100) / 100).toFixed(2) + '°';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Scene Is, in a Few Words ("Elevation, 1:50")
    // ------------------------------------------------------------
    function Na__LePanelPc__Kind(scene) {
        return scene.Scene__ViewTypeLabel + (scene.Scene__ScaleLabel ? ', ' + scene.Scene__ScaleLabel : '');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Scale on a List Nearest a Denominator (by ratio, so 1:75 is between 1:50 and 1:100)
    // ------------------------------------------------------------
    function Na__LePanelPc__NearestScale(list, denominator) {
        if (!list.length) return denominator;
        if (!(denominator > 0)) return list[0];
        return list.reduce((best, value) => (Math.abs(Math.log(value / denominator)) < Math.abs(Math.log(best / denominator)) ? value : best), list[0]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The TrueVision Scene That Shows a Drawing (null when none does)
    // ------------------------------------------------------------
    function Na__LePanelPc__SceneFor(planId, elevationId) {
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const scenes = (config && Array.isArray(config[Na__LePanelPc__SCENES_KEY])) ? config[Na__LePanelPc__SCENES_KEY] : [];
        const scene  = scenes.find((s) => s && ((planId && s.PresentationMode__Scene__FloorPlanId === planId) || (elevationId && s.PresentationMode__Scene__ElevationId === elevationId)));
        return scene ? scene.PresentationMode__Scene__Id : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Alike Two Names Are (shared words, for picking a plan by name)
    // ------------------------------------------------------------
    function Na__LePanelPc__Likeness(a, b) {
        const words = (text) => new Set(String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1));
        const left = words(a), right = words(b);
        let shared = 0;
        left.forEach((word) => { if (right.has(word)) shared += 1; });
        return shared;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which TrueVision Drawing a Scene Lays On
    // ------------------------------------------------------------
    // Returns { pending } while the scene's export is still loading, { why }
    // when nothing fits, or { kind : 'siteplan' | 'plan' | 'elevation', label,
    // drawingId, sceneId, axes, angleDeg } for the best fit:
    //   Site Plan  a site plan viewport, always
    //   Plan       a floor plan: the one whose name shares most words with the
    //              scene's, else the first. Any plan looks straight down.
    //   Elevation  an elevation looking the same way (within the tolerance),
    //   Section    a section first for a Section scene, then the nearest bearing
    // ------------------------------------------------------------
    function Na__LePanelPc__MatchFor(scene) {
        if (!scene) return { why : '' };
        if (scene.Scene__Projection !== 'orthographic') return { why : Na__LePanelPc__Label('PointCloudNo3d', 'Listed for later: a perspective scene cannot be laid on a drawing yet.') };
        const revision = Na__PcStore__GetRevision(scene.Scene__CurrentRevision);
        if (!revision) {
            if (Na__PcStore__GetRevisionNote(scene.Scene__CurrentRevision)) return { why : Na__LePanelPc__Label('PointCloudExportFailed', 'Its export did not load.') };
            Na__PcStore__LoadRevision(scene.Scene__Id, scene.Scene__CurrentRevision).catch(() => null);   // <-- The store announces it, and the panel refreshes
            return { pending : true };
        }
        if (!Na__PcPlace__IsOrthoFrame(revision.Frame)) return { why : Na__LePanelPc__Label('PointCloudNoFrame', 'Its export has no frame to place it by.') };
        const tolerance = Na__PcCfg__Alignment().toleranceDeg;

        if (scene.Scene__ViewType === 'siteplan') {
            const axes  = Na__PcPlace__SitePlanAxes();
            const angle = Na__PcPlace__AlignmentDeg(revision.Frame, axes);
            if (angle > tolerance) return { why : Na__LePanelPc__Label('PointCloudSitePlanTilted', 'This site plan scene does not look straight down.') };
            return { kind : 'siteplan', label : Na__LePanelPc__Label('PointCloudNewSitePlan', 'a new site plan viewport'),
                     drawingId : null, sceneId : null, axes : axes, angleDeg : angle };
        }
        if (Na__PcStore__IsTopDown(scene.Scene__ViewType)) {
            const axes  = Na__PcPlace__SitePlanAxes();                           // <-- A plan is drawn in the site plan's axes: world X and Z, seen from above
            const angle = Na__PcPlace__AlignmentDeg(revision.Frame, axes);
            if (angle > tolerance) return { why : Na__LePanelPc__Label('PointCloudPlanTilted', 'This plan scene does not look straight down.') };
            const plans = Na__FpData__GetFloorPlans(null);
            if (!plans.length) return { why : Na__LePanelPc__Label('PointCloudNoPlans', 'No TrueVision floor plan to lay it on.') };
            const best = plans.reduce((pick, plan) => (Na__LePanelPc__Likeness(plan.FloorPlan__Name, scene.Scene__Name) > Na__LePanelPc__Likeness(pick.FloorPlan__Name, scene.Scene__Name) ? plan : pick), plans[0]);
            return { kind : 'plan', label : best.FloorPlan__Name || best.FloorPlan__Id, drawingId : best.FloorPlan__Id,
                     sceneId : Na__LePanelPc__SceneFor(best.FloorPlan__Id, null), axes : { Kind : 'plan', AlongX : [ 1, 0, 0 ], AlongY : [ 0, 0, 1 ], TowardViewer : [ 0, 1, 0 ] }, angleDeg : angle };
        }
        if (Na__PcStore__IsFacing(scene.Scene__ViewType)) {
            const wantSection = scene.Scene__ViewType === 'section';
            const fits = Na__ElevData__GetElevations(null).map((elevation) => {
                const a    = Na__ElevData__GetAxes(elevation);
                const axes = { Kind : 'elevation', AlongX : [ a.rightX, 0, a.rightZ ], AlongY : [ 0, -1, 0 ], TowardViewer : [ a.normalX, 0, a.normalZ ] };
                return { elevation : elevation, axes : axes, angle : Na__PcPlace__AlignmentDeg(revision.Frame, axes), section : Na__ElevData__IsSection(elevation) };
            }).filter((fit) => fit.angle <= tolerance)
              .sort((x, y) => ((x.section === wantSection ? 0 : 1) - (y.section === wantSection ? 0 : 1)) || (x.angle - y.angle));
            if (!fits.length) {
                const x = -revision.Frame.NormalM[0], z = -revision.Frame.NormalM[2];
                const bearing = ((Math.atan2(x, -z) * (180 / Math.PI)) % 360 + 360) % 360;
                return { why : Na__LePanelPc__Label('PointCloudNoElevation', 'No TrueVision elevation looks this way. One at an azimuth of {deg} would.').replace('{deg}', Na__LePanelPc__Deg(bearing)) };
            }
            const fit = fits[0];
            return { kind : 'elevation', label : fit.elevation.Elevation__Name || fit.elevation.Elevation__Id, drawingId : fit.elevation.Elevation__Id,
                     sceneId : Na__LePanelPc__SceneFor(null, fit.elevation.Elevation__Id), axes : fit.axes, angleDeg : fit.angle };
        }
        return { why : '' };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Actions
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Write One Point Cloud Patch to the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelPc__Patch(patch, silent) {
        const sheet    = Na__LeModel__GetActiveSheet();
        const viewport = Na__LePanelPc__Selected();
        if (!sheet || !viewport) return false;
        return Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { pointCloud : patch }, silent === true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Viewport for a Scene: Its Drawing, the Nearest Scale, the Point Cloud On and Centred
    // ------------------------------------------------------------
    function Na__LePanelPc__Add(sceneId) {
        const sheet = Na__LeModel__GetActiveSheet();
        const scene = Na__PcStore__GetScene(sceneId);
        const match = Na__LePanelPc__MatchFor(scene);
        if (!sheet || !scene || !match || !match.kind) return null;
        const revision = Na__PcStore__GetRevision(scene.Scene__CurrentRevision);
        const isSite   = match.kind === 'siteplan';
        const scale    = Na__LePanelPc__NearestScale(Na__LeScale__ListDenominators(isSite), scene.Scene__ScaleDenominator || 0);
        const setup    = Na__LeCfg__GetViewportSetup();
        const layout   = Na__LeLayout__Solve(sheet);
        const options  = {
            kind : Na__LeModel__KIND_2D, scaleDenominator : scale,
            rect : Na__LeLayout__DefaultViewportRect(layout, setup.defaultWidthMm, setup.defaultHeightMm),
            pointCloud : { PointCloud__SceneId : scene.Scene__Id }
        };
        if (isSite) options.sitePlan = {};
        else { options.drawingId = match.drawingId; options.sceneId = match.sceneId || null; }
        const viewport = Na__LeScope__WithAdoption(sheet, [ 'viewport' ], () => Na__LeModel__CreateViewport(sheet, options));   // <-- Added while a group is open, it joins the group, in the same undo step
        if (!viewport) return null;
        // CENTRED ON THE PICTURE, worked out from the match's own axes so it is
        // known now, before the frame has drawn: the pan goes in silently and
        // the selection's announcement draws the frame where it belongs.
        if (revision && Na__PcPlace__IsOrthoFrame(revision.Frame)) {
            const bounds = Na__PcPlace__BoundsMm(Na__PcPlace__Matrix(revision.Frame, match.axes), revision.Frame.WidthPx, revision.Frame.HeightPx);
            Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { pan : { X : (bounds.MinX + bounds.MaxX) / 2, Y : (bounds.MinY + bounds.MaxY) / 2 } }, true);
        }
        Na__LeModel__SetSelection({ kind : 'viewport', id : viewport.Viewport__Id });
        return viewport;
    }
    // ------------------------------------------------------------


    // FUNCTION | Centre the Selected Viewport on Its Point Cloud
    // ------------------------------------------------------------
    function Na__LePanelPc__Centre() {
        const sheet    = Na__LeModel__GetActiveSheet();
        const viewport = Na__LePanelPc__Selected();
        if (!sheet || !viewport) return;
        const described = Na__LeModel__IsSitePlanViewport(viewport) ? null : Na__LeVp2d__Describe(viewport);
        const resolved  = Na__LeVp2d__PointCloudResolve(viewport, described, false);
        if (resolved.status !== Na__LeVp2d__PC_READY) return;
        const bounds = Na__PcPlace__BoundsMm(resolved.matrix, resolved.revision.Frame.WidthPx, resolved.revision.Frame.HeightPx);
        Na__LeModel__UpdateViewport(sheet, viewport.Viewport__Id, { pan : { X : (bounds.MinX + bounds.MaxX) / 2, Y : (bounds.MinY + bounds.MaxY) / 2 } });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Section
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Show the Section Only Where It Means Something
    // ------------------------------------------------------------
    function Na__LePanelPc__UpdateVisibility() {
        const viewport = Na__LePanelPc__Selected();
        const visible  = Na__PcStore__GetStatus() === Na__PcStore__STATUS_READY || (!!viewport && Na__LeModel__IsPointCloudViewport(viewport));
        Na__LePanels__SetSectionVisible(Na__LePanelPc__ID, visible);
        return visible;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Shell
    // ------------------------------------------------------------
    function Na__LePanelPc__Build(body) {
        const block = (name, element) => { element.setAttribute('data-na-block', name); body.appendChild(element); return element; };

        block('status', Na__LePanels__Note(''));

        const vpNote = block('vp-note', Na__LePanels__Note(Na__LePanelPc__Label('PointCloudSelectViewport', 'Select a plan, elevation, section or site plan viewport to lay a point cloud over it.')));
        vpNote.classList.add('na-le-pc__hint');

        const viewportRows = block('vp-rows', document.createElement('div'));
        const sceneSelect  = Na__LePanels__Select('pc-scene', [], '');
        viewportRows.appendChild(Na__LePanels__Row(Na__LePanelPc__Label('PointCloudScene', 'Scene'), sceneSelect));
        viewportRows.appendChild(Na__LePanels__SliderRow(Na__LePanelPc__Label('PointCloudOpacity', 'Opacity'), 'pc-opacity', { min : 0, max : 100, step : 5 }));
        Na__LePanelPc__TOGGLES.forEach((toggle) => {
            const input = Na__LePanels__Input('checkbox', 'pc-toggle');
            input.setAttribute('data-na-role', toggle.role);
            input.id = 'na-le-pc-' + (++Na__LePanelPc__IdSeed);
            const row = Na__LePanels__Row(Na__LePanelPc__Label(toggle.labelKey, toggle.label), input, 'na-le-row--toggle');
            row.htmlFor = input.id;
            row.title   = Na__LePanelPc__TOGGLE_HINTS[toggle.role] || '';
            row.setAttribute('data-na-toggle', toggle.role);
            viewportRows.appendChild(row);
        });
        const vpStatus = Na__LePanels__Note('');
        vpStatus.setAttribute('data-na-block', 'vp-status');
        viewportRows.appendChild(vpStatus);
        const centre = Na__LePanels__Button(Na__LePanelPc__Label('PointCloudCentre', 'Centre on Point Cloud'), 'pc-centre');
        centre.setAttribute('data-na-block', 'vp-centre');
        viewportRows.appendChild(centre);

        block('scenes-title', Na__LePanels__Note(Na__LePanelPc__Label('PointCloudScenesTitle', 'Exported scenes')));
        block('scenes', document.createElement('div'));
        block('reload', Na__LePanels__Button(Na__LePanelPc__Label('PointCloudReload', 'Reload Exports'), 'pc-reload'));

        Na__PcCfg__Ready().then(() => Na__LePanels__Refresh(Na__LePanelPc__ID));
        Na__PcStore__Resolve();                                                  // <-- The manifest only: no picture loads until a viewport draws one
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Line Under a Viewport's Controls
    // ------------------------------------------------------------
    function Na__LePanelPc__ViewportSentence(viewport, resolved) {
        const parts = [];
        if (resolved.status === Na__LeVp2d__PC_HIDDEN) return Na__LePanelPc__Label('PointCloudHiddenNote', 'Hidden. Tick Show Point Cloud to draw it.');
        if (resolved.status !== Na__LeVp2d__PC_READY) {
            parts.push(resolved.message);
            if (resolved.status === Na__LeVp2d__PC_MISALIGNED && resolved.neededAzimuthDeg !== null) {
                parts.push(Na__LePanelPc__Label('PointCloudNeedsAzimuth', 'It needs an elevation at an azimuth of {deg}.').replace('{deg}', Na__LePanelPc__Deg(resolved.neededAzimuthDeg)));
            }
            return parts.filter(Boolean).join(' ');
        }
        const tolerance = Na__PcCfg__Alignment();
        if (resolved.angleDeg <= tolerance.quietDeg) {
            parts.push(Na__LePanelPc__Label('PointCloudAligned', 'Looks the same way as this drawing.'));
        } else {
            parts.push(Na__LePanelPc__Label('PointCloudDrift', 'Looks {deg} away from this drawing: a point 1 m in front of or behind the scene\'s target plane is drawn {mm} mm off.')
                .replace('{deg}', Na__LePanelPc__Deg(resolved.angleDeg)).replace('{mm}', String(Math.round(resolved.driftMmPerM * 10) / 10)));
        }
        const when = Na__LePanelPc__When(resolved.revision.Revision__ExportedIso);
        if (resolved.pinned) {
            parts.push(Na__LePanelPc__Label('PointCloudPinned', 'Kept at the export of {when}.').replace('{when}', when || resolved.revisionId));
            if (resolved.newerExists) parts.push(Na__LePanelPc__Label('PointCloudNewer', 'A newer export exists: tick SketchUp Sync to follow it.'));
        } else if (when) {
            parts.push(Na__LePanelPc__Label('PointCloudExportOf', 'Export of {when}.').replace('{when}', when));
        }
        const exported = resolved.revision.Scene__ScaleDenominator;
        const drawnAt  = viewport.Viewport__ScaleDenominator;
        if (exported && drawnAt && Math.abs(exported - drawnAt) > 1e-6) {
            parts.push(Na__LePanelPc__Label('PointCloudScaleNote', 'Exported for 1:{exported}, so at 1:{drawn} its dots print {factor} times their intended size.')
                .replace('{exported}', String(exported)).replace('{drawn}', String(drawnAt))
                .replace('{factor}', String(Math.round((exported / drawnAt) * 100) / 100)));
        }
        return parts.join(' ');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Selected Viewport
    // ------------------------------------------------------------
    function Na__LePanelPc__RefreshViewport(body) {
        const viewport = Na__LePanelPc__Selected();
        const rows     = body.querySelector('[data-na-block="vp-rows"]');
        body.querySelector('[data-na-block="vp-note"]').hidden = !!viewport;
        rows.hidden = !viewport;
        if (!viewport) return;

        const block    = Na__LeModel__IsPointCloudViewport(viewport) ? viewport.Viewport__PointCloud : null;
        const sceneId  = block ? block.PointCloud__SceneId : '';
        const options  = [ { value : '', label : Na__LePanelPc__Label('PointCloudNone', 'None') } ];
        Na__PcStore__GetScenes(false).forEach((scene) => options.push({ value : scene.Scene__Id, label : scene.Scene__Name + ' (' + Na__LePanelPc__Kind(scene) + ')' }));
        if (sceneId && !options.some((option) => option.value === sceneId)) {
            const known = Na__PcStore__GetScene(sceneId);
            options.push({ value : sceneId, label : known ? known.Scene__Name + ' (' + Na__LePanelPc__Label('PointCloudRetired', 'no longer exported') + ')'
                                                          : sceneId + ' (' + Na__LePanelPc__Label('PointCloudNotFound', 'not in the exports') + ')' });
        }
        const select = rows.querySelector('[data-na-control="pc-scene"]');
        if (document.activeElement !== select) Na__LePanels__FillSelect(select, options, sceneId);

        const described = Na__LeModel__IsSitePlanViewport(viewport) ? null : Na__LeVp2d__Describe(viewport);
        const resolved  = Na__LeVp2d__PointCloudResolve(viewport, described, true);
        const attached  = !!block;
        const opacity   = Math.round((Number.isFinite(resolved.opacity) ? resolved.opacity : 0.65) * 100);
        Na__LePanels__ShowSlider(rows, 'pc-opacity', opacity, opacity + '%');
        rows.querySelectorAll('[data-na-control="pc-opacity"]').forEach((el) => { el.disabled = !attached || !Na__LePanels__IsEditable(); });

        const values = {
            visible       : attached && block.PointCloud__Hidden !== true,
            lineworkOnTop : attached && block.PointCloud__LineworkOnTop === true,
            sync          : attached && typeof block.PointCloud__PinnedRevision !== 'string',
            datum         : attached && block.PointCloud__ShowDatum === true
        };
        Na__LePanelPc__TOGGLES.forEach((toggle) => {
            const row   = rows.querySelector('[data-na-toggle="' + toggle.role + '"]');
            const input = row ? row.querySelector('[data-na-control="pc-toggle"]') : null;
            if (!row || !input) return;
            row.hidden     = !attached;
            input.checked  = values[toggle.role];
            input.disabled = !Na__LePanels__IsEditable() || (toggle.role === 'sync' && !resolved.revisionId);
        });
        rows.querySelectorAll('.na-le-input--range[data-na-control="pc-opacity"]').forEach((el) => { el.closest('.na-le-row').hidden = !attached; });

        const status = rows.querySelector('[data-na-block="vp-status"]');
        status.hidden = !attached;
        status.textContent = attached ? Na__LePanelPc__ViewportSentence(viewport, resolved) : '';
        status.classList.toggle('na-le-pc__note--warn', attached && resolved.status !== Na__LeVp2d__PC_READY && resolved.status !== Na__LeVp2d__PC_HIDDEN);
        const centre = rows.querySelector('[data-na-block="vp-centre"]');
        centre.hidden   = !attached;
        centre.disabled = resolved.status !== Na__LeVp2d__PC_READY || !Na__LePanels__IsEditable();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | List the Exported Scenes, Each With What It Lays On
    // ------------------------------------------------------------
    function Na__LePanelPc__RefreshScenes(body) {
        const list   = body.querySelector('[data-na-block="scenes"]');
        const scenes = Na__PcStore__GetScenes(false);
        body.querySelector('[data-na-block="scenes-title"]').hidden = !scenes.length;
        list.innerHTML = '';
        scenes.forEach((scene) => {
            const match = Na__LePanelPc__MatchFor(scene);
            const row   = document.createElement('div');
            row.className = 'na-le-pc__scene';
            const name = document.createElement('div');
            name.className   = 'na-le-pc__scene-name';
            name.textContent = scene.Scene__Name;
            name.title       = scene.Scene__Name + (scene.Scene__SourceModel ? ' (' + scene.Scene__SourceModel + ')' : '');
            const add = Na__LePanels__Button(Na__LePanelPc__Label('PointCloudAddViewport', 'Add Viewport'), 'pc-add', '', scene.Scene__Id);
            add.disabled = !match.kind || !Na__LePanels__IsEditable();
            const meta = document.createElement('div');
            meta.className = 'na-le-pc__scene-meta';
            const when = Na__LePanelPc__When(scene.Scene__UpdatedIso);
            const lays = match.pending ? Na__LePanelPc__Label('PointCloudChecking', 'Checking which drawing it lays on.')
                : (match.kind ? Na__LePanelPc__Label('PointCloudLaysOn', 'Lays on {name}.').replace('{name}', match.label || '') : (match.why || ''));
            meta.textContent = Na__LePanelPc__Kind(scene) + '. ' + (when ? Na__LePanelPc__Label('PointCloudExported', 'Exported {when}.').replace('{when}', when) + ' ' : '') + lays;
            row.appendChild(name);
            row.appendChild(add);
            row.appendChild(meta);
            list.appendChild(row);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reflect the Store, the Selected Viewport and the Scene List
    // ------------------------------------------------------------
    function Na__LePanelPc__Refresh(body) {
        if (!Na__LePanelPc__UpdateVisibility()) return;
        const status = Na__PcStore__GetStatus();
        const line   = body.querySelector('[data-na-block="status"]');
        const descriptor = Na__PcStore__GetDescriptor();
        if (status === Na__PcStore__STATUS_READY && descriptor) {
            const count = Na__PcStore__GetScenes(false).length;
            const when  = Na__LePanelPc__When(descriptor.Store__ExportedIso);
            line.textContent = Na__LePanelPc__Label('PointCloudStoreReady', '{count} point cloud scenes exported from SketchUp{when}.')
                .replace('{count}', String(count)).replace('{when}', when ? ', last on ' + when : '');
        } else if (status === Na__PcStore__STATUS_EMPTY) {
            line.textContent = Na__LePanelPc__Label('PointCloudStoreEmpty', 'No point cloud exports for this project. Export them from SketchUp with TrueVision Sync, then Reload Exports.');
            line.title       = Na__PcStore__GetNote() || '';
        } else if (status === Na__PcStore__STATUS_LOADING) {
            line.textContent = Na__LePanelPc__Label('PointCloudStoreLoading', 'Reading the point cloud exports.');
        } else {
            line.textContent = '';
        }
        Na__LePanelPc__RefreshViewport(body);
        Na__LePanelPc__RefreshScenes(body);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Listen Once: the Store, the Model and the Paper's Zoom
    // ------------------------------------------------------------
    function Na__LePanelPc__Wire() {
        if (Na__LePanelPc__Wired) return;
        Na__LePanelPc__Wired = true;
        window.addEventListener(Na__PcStore__CHANGED_EVENT, () => { Na__LePanelPc__UpdateVisibility(); Na__LePanels__Refresh(Na__LePanelPc__ID); });
        window.addEventListener(Na__LeModel__CHANGED_EVENT, () => Na__LePanelPc__UpdateVisibility());   // <-- Folded, the section is not refreshed, but whether it shows still follows the selection
        window.addEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, (event) => {
            const zoom = event && event.detail ? event.detail.zoom : Na__LeSurface__GetZoom();
            Na__LeVp2d__PointCloudSetZoom(zoom);
        });
        Na__LeVp2d__PointCloudSetZoom(Na__LeSurface__GetZoom());
    }
    // ------------------------------------------------------------


    // FUNCTION | Register the Section and Its Controls
    // ------------------------------------------------------------
    function Na__LePanelPc__Register() {
        Na__LePanels__OnControl('change', 'pc-scene', (e, el) => {
            const value = el.value;
            if (!value) { Na__LePanelPc__Patch(null); return; }
            Na__LePanelPc__Patch({ PointCloud__SceneId : value, PointCloud__PinnedRevision : null });
        });
        Na__LePanels__OnControl('input', 'pc-opacity', (e, el) => {          // <-- While dragging: written quietly, drawn at once
            const value = parseFloat(el.value);
            if (!Number.isFinite(value)) return;
            if (Na__LePanelPc__Patch({ PointCloud__Opacity : Math.max(0, Math.min(100, value)) / 100 }, true)) Na__LeVp2d__PointCloudRefreshAll();
        });
        Na__LePanels__OnControl('change', 'pc-opacity', (e, el) => {         // <-- Let go: announced, one undo step
            const value = parseFloat(el.value);
            if (Number.isFinite(value)) Na__LePanelPc__Patch({ PointCloud__Opacity : Math.max(0, Math.min(100, value)) / 100 });
        });
        Na__LePanels__OnControl('change', 'pc-toggle', (e, el, role) => {
            const viewport = Na__LePanelPc__Selected();
            if (!viewport || !Na__LeModel__IsPointCloudViewport(viewport)) return;
            if (role === 'visible')       Na__LePanelPc__Patch({ PointCloud__Hidden : el.checked ? null : true });
            if (role === 'lineworkOnTop') Na__LePanelPc__Patch({ PointCloud__LineworkOnTop : el.checked ? true : null });
            if (role === 'datum')         Na__LePanelPc__Patch({ PointCloud__ShowDatum : el.checked ? true : null });
            if (role === 'sync') {
                if (el.checked) { Na__LePanelPc__Patch({ PointCloud__PinnedRevision : null }); return; }
                const described = Na__LeModel__IsSitePlanViewport(viewport) ? null : Na__LeVp2d__Describe(viewport);
                const resolved  = Na__LeVp2d__PointCloudResolve(viewport, described, false);
                if (resolved.revisionId) Na__LePanelPc__Patch({ PointCloud__PinnedRevision : resolved.revisionId });   // <-- Pinned to what it shows NOW
                else el.checked = true;
            }
        });
        Na__LePanels__OnControl('click', 'pc-centre', () => Na__LePanelPc__Centre());
        Na__LePanels__OnControl('click', 'pc-add', (e, el, sceneId) => { if (sceneId) Na__LePanelPc__Add(sceneId); });
        Na__LePanels__OnControl('click', 'pc-reload', () => { void Na__LeVp2d__PointCloudReload(); });

        const entry = Na__LePanels__RegisterSection('right', {
            id      : Na__LePanelPc__ID,
            title   : Na__LePanelPc__Label('PointCloudToolsTitle', 'Point Cloud Tools'),
            build   : Na__LePanelPc__Build,
            refresh : Na__LePanelPc__Refresh
        });
        Na__LePanelPc__Wire();
        Na__LePanelPc__UpdateVisibility();                                       // <-- Hidden until the exports are read, or a viewport carries one
        return entry;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Point Cloud Tools Panel API
    // ------------------------------------------------------------
    export {
        Na__LePanelPc__Register,
        Na__LePanelPc__MatchFor,
        Na__LePanelPc__Add
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
