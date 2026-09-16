// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - VIEWPORTS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__Viewports__.js
// NAMESPACE  : Na__LeModel
// MODULE     : Layout Editor - Sheet Model - Viewports
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A sheet's viewports: find, add, paste, remove and change them, and resolve what each one shows
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - A sheet's viewports and one viewport by id; CreateViewport builds one
//   from options and InsertViewport puts down a complete record (a paste or
//   a duplicate).
// - DeleteViewport also lets go of the sheet dimensions measuring through
//   it. UpdateViewport changes any subset of a viewport's fields, merging
//   the model layers, projected edges and composite weights.
// - ResolveViewportSource answers the scene and, for 2D, the plan or
//   elevation record a viewport draws, with nulls where a link dangles.
// - TrueVision only: IsSitePlanViewport reads the site plan marker. A site
//   plan viewport resolves with no scene or drawing, and its scale is
//   coerced onto its own list.
// - The silent paths of InsertViewport and UpdateViewport set the dirty
//   flag through the State unit's AssignDirty (an imported let cannot be
//   assigned).
//
// INTEGRATION:
// - Imports Na__LayoutEditor__SheetModel__State__ and
//   Na__LayoutEditor__SheetModel__Layers__ (GetLayerById, DefaultLayerId),
//   and the site plan viewport's label from Na__LayoutEditor__ConfigState__.
// - Na__LayoutEditor__SheetModel__ calls GetViewportById for the selected
//   viewport and re-exports this unit's API. Every other module imports
//   Na__LayoutEditor__SheetModel__.js, never this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : header and folder numbers; site plan viewports, TrueVision first (IsSitePlanViewport is TrueVision only; UpdateViewport and ResolveViewportSource handle them), InsertViewport's silent flag, CreateViewport's modelSourceId, sitePlan and modelLayers options, and UpdateViewport's showFrame, closedDoors and modelSourceId keys.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetModel__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Drawing Records and Scenes
    // ------------------------------------------------------------
    import { Na__FpData__GetPlanById } from '../../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';
    import { Na__ElevData__GetElevationById } from '../../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js';
    import { Na__PresentationMode__ProjectJson__GetActiveConfig } from '../../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Record Helpers, Scale, Edge Styles and Composites
    // ------------------------------------------------------------
    import {
        Na__LeRec__IsSitePlanViewport,
        Na__LeRec__NextId,
        Na__LeRec__Find,
        Na__LeRec__NormaliseViewport
    } from './Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeScale__Coerce } from './Na__LayoutEditor__ScaleManager__.js';
    import { Na__LeEdge__FIELD, Na__LeEdge__CAT_FIELD } from '../25__System__RenderStyles/Na__LayoutEditor__EdgeStyles__.js';
    import { Na__LeComposite__FIELD, Na__LeComposite__Clamp } from '../25__System__RenderStyles/Na__LayoutEditor__RenderComposites__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Labels (the site plan viewport name)
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Model State and Layers
    // ------------------------------------------------------------
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__KIND_3D,
        Na__LeModel__SCENES_KEY,
        Na__LeModel__STYLE_KEYS,
        Na__LeModel__Touch,
        Na__LeModel__Unselect,
        Na__LeModel__AssignDirty
    } from './Na__LayoutEditor__SheetModel__State__.js';
    import { Na__LeModel__GetLayerById, Na__LeModel__DefaultLayerId } from './Na__LayoutEditor__SheetModel__Layers__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Viewports
// -----------------------------------------------------------------------------

    // FUNCTION | A Sheet's Viewports
    // ------------------------------------------------------------
    function Na__LeModel__GetViewports(sheet) {
        return sheet ? sheet.Sheet__Viewports : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | One Viewport by Id
    // ------------------------------------------------------------
    function Na__LeModel__GetViewportById(sheet, viewportId) {
        return sheet ? Na__LeRec__Find(sheet.Sheet__Viewports, 'Viewport__Id', viewportId) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This a Site Plan Viewport
    // ------------------------------------------------------------
    function Na__LeModel__IsSitePlanViewport(viewport) {
        return Na__LeRec__IsSitePlanViewport(viewport);
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Viewport
    // ------------------------------------------------------------
    // options: { kind, sceneId, drawingId, name, rect, scaleDenominator, modelSourceId,
    //           sitePlan (an object: a site plan viewport), modelLayers (categories switched off) }
    // ------------------------------------------------------------
    function Na__LeModel__CreateViewport(sheet, options) {
        if (!sheet) return null;
        const opts = options || {};
        const viewport = Na__LeRec__NormaliseViewport({
            Viewport__Id               : Na__LeRec__NextId(sheet.Sheet__Viewports, 'Viewport_', 'Viewport__Id'),
            Viewport__Kind             : opts.kind,
            Viewport__SceneId          : opts.sceneId || null,
            Viewport__DrawingId        : opts.drawingId || null,
            Viewport__ModelSourceId    : opts.modelSourceId || null,
            Viewport__Name             : opts.name || '',
            Viewport__FrameMm          : opts.rect || null,
            Viewport__ScaleDenominator : opts.scaleDenominator,
            Viewport__SitePlan         : (opts.sitePlan && typeof opts.sitePlan === 'object') ? Object.assign({}, opts.sitePlan) : undefined,
            Viewport__ModelLayers      : (opts.modelLayers && typeof opts.modelLayers === 'object') ? Object.assign({}, opts.modelLayers) : null
        }, Na__LeModel__DefaultLayerId(sheet, 'viewport'));
        sheet.Sheet__Viewports.push(viewport);
        Na__LeModel__Touch('viewports', sheet.Sheet__Id, viewport.Viewport__Id);
        return viewport;
    }
    // ------------------------------------------------------------


    // FUNCTION | Add a Whole Viewport Record (a paste or a duplicate)
    // ------------------------------------------------------------
    // Where CreateViewport builds a viewport from a handful of options, this
    // takes a complete record - scene, scale, crop, window, composites, model
    // layers, edge styles - deep-copies it and gives it a fresh id, so a
    // viewport set up once can be put down again with every setting intact.
    // A layer id the sheet does not have falls back to the default viewport
    // layer. Appended last, so it draws in front on its layer. One
    // announcement, so one undo step.
    // ------------------------------------------------------------
    function Na__LeModel__InsertViewport(sheet, record, silent) {
        if (!sheet || !record || typeof record !== 'object') return null;
        const viewport = JSON.parse(JSON.stringify(record));
        viewport.Viewport__Id = Na__LeRec__NextId(sheet.Sheet__Viewports, 'Viewport_', 'Viewport__Id');
        if (!Na__LeModel__GetLayerById(sheet, viewport.Viewport__LayerId)) viewport.Viewport__LayerId = null;
        Na__LeRec__NormaliseViewport(viewport, Na__LeModel__DefaultLayerId(sheet, 'viewport'));
        sheet.Sheet__Viewports.push(viewport);
        if (silent) { Na__LeModel__AssignDirty(true); return viewport; }
        Na__LeModel__Touch('viewports', sheet.Sheet__Id, viewport.Viewport__Id);
        return viewport;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove a Viewport and the Sheet Dimensions Measuring Through It
    // ------------------------------------------------------------
    function Na__LeModel__DeleteViewport(sheet, viewportId) {
        if (!sheet) return false;
        const index = sheet.Sheet__Viewports.findIndex((v) => v.Viewport__Id === viewportId);
        if (index === -1) return false;
        sheet.Sheet__Viewports.splice(index, 1);
        sheet.Sheet__Dimensions.forEach((d) => { if (d.Dimension__ViewportId === viewportId) d.Dimension__ViewportId = null; });
        Na__LeModel__Unselect(viewportId);
        Na__LeModel__Touch('viewports', sheet.Sheet__Id, viewportId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change a Viewport (any subset of its fields)
    // ------------------------------------------------------------
    // patch: { rect, scaleDenominator, pan, imageMm, imageOffset, imageZoom, styles, modelLayers,
    //          projectedEdges, compositeWeights, markupMode, name, layerId,
    //          sceneId, drawingId, kind, showScaleLabel, showFrame, locked, snapshotAsset, modelSourceId,
    //          closedDoors }
    // silent: true skips the change event (live drags announce on release).
    // ------------------------------------------------------------
    function Na__LeModel__UpdateViewport(sheet, viewportId, patch, silent) {
        const viewport = Na__LeModel__GetViewportById(sheet, viewportId);
        if (!viewport || !patch) return false;

        if (patch.rect)      viewport.Viewport__FrameMm = Object.assign({}, viewport.Viewport__FrameMm, patch.rect);
        if (patch.pan)       viewport.Viewport__PanMm   = Object.assign({}, viewport.Viewport__PanMm,   patch.pan);
        if (patch.imageMm)   viewport.Viewport__ImageMm = Object.assign({}, viewport.Viewport__ImageMm, patch.imageMm);
        if (patch.imageOffset) viewport.Viewport__ImageOffsetMm = Object.assign({}, viewport.Viewport__ImageOffsetMm, patch.imageOffset);
        if (patch.imageZoom !== undefined) viewport.Viewport__ImageZoom = patch.imageZoom;   // <-- A 3D picture's zoom; the normaliser clamps it and keeps it only when it is not 1
        if (patch.styles) {
            Na__LeModel__STYLE_KEYS.forEach((key) => { if (typeof patch.styles[key] === 'boolean') viewport.Viewport__Styles[key] = patch.styles[key]; });
        }
        if (patch.modelLayers) {
            // MERGED, NOT REPLACED, so the panel can send one category at a
            // time. The normaliser below drops anything set back to true, so
            // switching a category on again removes the key rather than
            // recording a redundant "yes".
            const merged = Object.assign({}, viewport.Viewport__ModelLayers || {});
            Object.keys(patch.modelLayers).forEach((key) => { if (typeof patch.modelLayers[key] === 'boolean') merged[key] = patch.modelLayers[key]; });
            viewport.Viewport__ModelLayers = merged;
        }
        if (patch.projectedEdges) {
            // MERGED, ONE CATEGORY AT A TIME, and a null value CLEARS that
            // category rather than storing an empty entry - which is how the
            // panel's Reset button leaves no trace that anything was touched.
            const held   = viewport[Na__LeEdge__FIELD] || {};
            const merged = Object.assign({}, held[Na__LeEdge__CAT_FIELD] || {});
            Object.keys(patch.projectedEdges).forEach((key) => {
                const value = patch.projectedEdges[key];
                if (value === null || value === undefined) { delete merged[key]; return; }
                if (typeof value === 'object') merged[key] = value;
            });
            const next = {};
            next[Na__LeEdge__CAT_FIELD] = merged;
            next['Edges__UpdatedIso']   = new Date().toISOString();             // <-- Stamped where a change is known to have happened, not in the normaliser
            viewport[Na__LeEdge__FIELD] = next;
        }
        if (patch.compositeWeights) {
            const merged = Object.assign({}, viewport[Na__LeComposite__FIELD] || {});
            Object.keys(patch.compositeWeights).forEach((key) => {
                const value = patch.compositeWeights[key];
                if (value === null || value === undefined) { delete merged[key]; return; }
                const clamped = Na__LeComposite__Clamp(key, parseFloat(value));
                if (Number.isFinite(clamped)) merged[key] = clamped;
            });
            viewport[Na__LeComposite__FIELD] = merged;
        }
        if (patch.scaleDenominator !== undefined) viewport.Viewport__ScaleDenominator = Na__LeScale__Coerce(patch.scaleDenominator, Na__LeRec__IsSitePlanViewport(viewport));   // <-- Onto the viewport's own list
        if (patch.markupMode === 'scene' || patch.markupMode === 'sheet') viewport.Viewport__MarkupMode = patch.markupMode;
        if (typeof patch.name === 'string') viewport.Viewport__Name = patch.name;
        if (typeof patch.layerId === 'string') viewport.Viewport__LayerId = patch.layerId;
        if (patch.sceneId !== undefined)   viewport.Viewport__SceneId   = patch.sceneId;
        if (patch.drawingId !== undefined) viewport.Viewport__DrawingId = patch.drawingId;
        if (patch.kind === Na__LeModel__KIND_2D || patch.kind === Na__LeModel__KIND_3D) viewport.Viewport__Kind = patch.kind;
        if (typeof patch.showScaleLabel === 'boolean') viewport.Viewport__ShowScaleLabel = patch.showScaleLabel;
        if (typeof patch.showFrame === 'boolean') viewport.Viewport__ShowFrame = patch.showFrame;   // <-- The normaliser keeps only false
        if (Array.isArray(patch.closedDoors)) viewport.Viewport__ClosedDoors = patch.closedDoors.slice();   // <-- The normaliser sorts it and drops an empty list
        if (typeof patch.locked === 'boolean') viewport.Viewport__Locked = patch.locked;
        if (patch.snapshotAsset !== undefined) viewport.Viewport__SnapshotAsset = patch.snapshotAsset;
        if (patch.modelSourceId !== undefined) viewport.Viewport__ModelSourceId = patch.modelSourceId || null;   // <-- The design phase drawn; empty is the Project Default

        Na__LeRec__NormaliseViewport(viewport, viewport.Viewport__LayerId);
        if (silent) { Na__LeModel__AssignDirty(true); return true; }
        Na__LeModel__Touch('viewport', sheet.Sheet__Id, viewportId);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Viewport Shows: the Scene and, for 2D, the Drawing Record
    // ------------------------------------------------------------
    // Returns { kind, scene, plan, elevation, label } with nulls where the
    // link is dangling, so a viewport whose scene was deleted still draws
    // its frame and says so. A site plan viewport has no scene, plan or
    // elevation, and carries sitePlan (its Viewport__SitePlan record).
    // ------------------------------------------------------------
    function Na__LeModel__ResolveViewportSource(viewport) {
        if (Na__LeRec__IsSitePlanViewport(viewport)) {
            return { kind : Na__LeModel__KIND_2D, scene : null, plan : null, elevation : null, sitePlan : viewport.Viewport__SitePlan,
                     label : viewport.Viewport__Name || Na__LeCfg__GetLabel('SitePlanViewportName', 'Site Plan') };
        }
        const config = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const scenes = (config && Array.isArray(config[Na__LeModel__SCENES_KEY])) ? config[Na__LeModel__SCENES_KEY] : [];
        const scene  = viewport.Viewport__SceneId ? (scenes.find((s) => s && s.PresentationMode__Scene__Id === viewport.Viewport__SceneId) || null) : null;

        let plan = null, elevation = null;
        if (viewport.Viewport__Kind === Na__LeModel__KIND_2D) {
            plan      = viewport.Viewport__DrawingId ? Na__FpData__GetPlanById(null, viewport.Viewport__DrawingId) : null;
            elevation = (!plan && viewport.Viewport__DrawingId) ? Na__ElevData__GetElevationById(null, viewport.Viewport__DrawingId) : null;
            if (!plan && !elevation && scene) {
                if (scene.PresentationMode__Scene__FloorPlanId)  plan      = Na__FpData__GetPlanById(null, scene.PresentationMode__Scene__FloorPlanId);
                if (scene.PresentationMode__Scene__ElevationId)  elevation = Na__ElevData__GetElevationById(null, scene.PresentationMode__Scene__ElevationId);
            }
        }

        const label = viewport.Viewport__Name
            || (plan && plan.FloorPlan__Name)
            || (elevation && elevation.Elevation__Name)
            || (scene && scene.PresentationMode__Scene__Name)
            || 'Viewport';

        return { kind : viewport.Viewport__Kind, scene : scene, plan : plan, elevation : elevation, label : label };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Model Viewports API
    // ------------------------------------------------------------
    export {
        Na__LeModel__GetViewports,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsSitePlanViewport,
        Na__LeModel__CreateViewport,
        Na__LeModel__InsertViewport,
        Na__LeModel__DeleteViewport,
        Na__LeModel__UpdateViewport,
        Na__LeModel__ResolveViewportSource
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
