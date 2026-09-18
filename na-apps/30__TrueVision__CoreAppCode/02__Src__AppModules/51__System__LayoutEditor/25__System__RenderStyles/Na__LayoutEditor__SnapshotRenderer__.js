// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SNAPSHOT RENDERER
// =============================================================================
//
// FILE       : Na__LayoutEditor__SnapshotRenderer__.js
// NAMESPACE  : Na__LeSnap
// MODULE     : Layout Editor - Snapshot Renderer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Offscreen pictures for both viewport kinds through the live pipeline, restoring everything touched
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - 2D underlay: the drawing's cut goes onto the section adapter, an
//   orthographic camera of the module's own is framed on the viewport's
//   model window, the composer and material presets are entered with the
//   viewport's style toggles, and the tiled renderer paints it at the
//   requested pixels per paper millimetre. Then the cut, the presets and
//   the 3D suspension are undone in reverse.
// - 3D snapshot: the main camera is posed from the scene record (which also
//   applies the scene's layer visibility and cross section binding), the
//   material preset applies whitecard and opaque glass, the profile lines
//   pass follows the toggle, the tiled renderer paints, and the pose,
//   visibility, sections and pass are put back.
// - Renders queue one behind another: the renderer and the presets are
//   shared state and two renders in flight would trample each other.
//
// INTEGRATION:
// - Initialized from index.html with the renderer, scene, camera, controls,
//   pipeline ref and model root.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__SnapshotRenderer__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers; the design
//                   phase model source of 1.6.0 (TrueVision - ValeVision has
//                   no model groups); the plan door pose of 1.7.0, authored
//                   here first and PENDING to ValeVision3D on Adam's sign-off; the 3D view
//                   window of 1.8.0, likewise.
// - Back-port     : n/a (this IS the back-port); 1.5.0 ported 13-Sep-2026 as ValeVision3D v2.28.0, through ValeVision's own width consumers (DIV-1)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 18-Sep-2026 - Version 1.10.0 (TrueVision)
// - The model fingerprint (what keys a 3D snapshot) takes each category's
//   content stamp as well as its name and triangle count, through one helper
//   for the live model and the design phases alike. A re-export that moves
//   something without changing a count now re-keys the snapshots, as it does
//   the linework and the base images (the pipeline fingerprint, 1.2.0 of the
//   model stage). An unstamped model keys exactly as before.
//
// 18-Sep-2026 - Version 1.9.0 (TrueVision)
// - stillWanted. Render2d and Render3d take an optional last argument, a
//   function asked when the render's turn in the queue comes; false answers
//   null without rendering. Renders are queued one behind another, so a sheet
//   left while its viewports were still waiting used to hold up the sheet
//   arrived at; the viewport cache answers false for a sheet that is parked.
//   A caller that passes nothing - the PDF, a bake, a forced render - is always
//   rendered, as before.
//
// 14-Sep-2026 - Version 1.8.0
// - Render3d takes a view window: the part of the scene camera's picture a
//   zoomed or slid 3D viewport's frame shows (Na__LayoutEditor__Viewport3d__),
//   handed to the tiled renderer as viewWindow. Null renders the whole picture
//   as before.
//
// 14-Sep-2026 - Version 1.7.1
// - Comments only. Render2d stands whatever pose the definition carries, so
//   an elevation or section - which now carries the shut pose - renders its
//   base image with every door shut, through the same code as a plan.
//
// 14-Sep-2026 - Version 1.7.0
// - Plan doors. Render2d stands the doors as a Layout Editor plan draws them -
//   open, bar the ones its viewport closed - before the cut is built and the
//   picture is taken, so the base image agrees with the linework over it. The
//   doors go back to where the 3D view holds them in the finally, before the
//   design phase leaves the scene.
//
// 13-Sep-2026 - Version 1.6.0
// - Design phases. Render2d and Render3d take the viewport's model source: a
//   phase the 3D view does not hold replaces the live model in the scene for
//   that one render. The section engine, the material preset, the category
//   registry and both profile line caches follow it, and all of it is handed
//   back before the next render starts. Fingerprints are held per phase. A
//   viewport of the live phase renders exactly as before.
//
// 13-Sep-2026 - Version 1.5.0
// - The Base Image composite weight: the model's own edges draw at the
//   viewport's width for one render, 2D and 3D, and every edge material is
//   handed its own width back afterwards.
//
// 12-Sep-2026 - Version 1.4.0
// - Per-viewport Model Layers: named model categories come out of the render
//   alongside the Context Layer rule, under one captured visibility map.
//
// 10-Sep-2026 - Version 1.3.0
// - Context Layer off takes the existing building and its surroundings out of the picture; the visibility is put back afterwards.
//
// 10-Sep-2026 - Version 1.2.0
// - The Enhance Whitecard pass runs on the render canvas when the viewport style asks for it.
//
// 10-Sep-2026 - Version 1.1.0
// - Session-cached model fingerprints (no model walk per refresh); the profile lines pass state is restored after a 2D render.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Enhance Whitecard Pass
    // ------------------------------------------------------------
    import { Na__LeEnhance__Apply } from './Na__LayoutEditor__Enhance__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Three, Units, Render Loop
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { Na__Math__ConvertMmToUnits, Na__Math__ConvertUnitsToMm } from '../../04__MathUtils/Na__Math__Units.js';
    import { Na__RenderLoop__RequestRender, Na__RenderLoop__Pause, Na__RenderLoop__Resume } from '../../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing View Core (presets, section adapter, transitions)
    // ------------------------------------------------------------
    import {
        Na__DrawView__SectionAdapter__UpsertHorizontalPlane,
        Na__DrawView__SectionAdapter__UpsertVerticalPlane,
        Na__DrawView__SectionAdapter__SetActivePlane,
        Na__DrawView__SectionAdapter__RemovePlane,
        Na__DrawView__SectionAdapter__SuspendLiveTool,
        Na__DrawView__SectionAdapter__Release,
        Na__DrawView__SectionAdapter__ReapplyClipping
    } from '../../40__System__DrawingViewCore/Na__DrawView__SectionAdapter__.js';
    import {
        Na__DrawView__RenderPreset__Enter,
        Na__DrawView__RenderPreset__Exit,
        Na__DrawView__RenderPreset__RenderFrame,
        Na__DrawView__RenderPreset__GetExportOverrides
    } from '../../40__System__DrawingViewCore/Na__DrawView__RenderPreset__.js';
    import {
        Na__DrawView__MaterialPreset__Enter,
        Na__DrawView__MaterialPreset__Exit,
        Na__DrawView__MaterialPreset__SetModelRoot
    } from '../../40__System__DrawingViewCore/Na__DrawView__MaterialPreset__.js';
    import {
        Na__DrawView__Transitions__SuspendThreeD,
        Na__DrawView__Transitions__ResumeThreeD,
        Na__DrawView__Transitions__IsSuspended
    } from '../../40__System__DrawingViewCore/Na__DrawView__Transitions__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Plan and Elevation Records and Camera Setups
    // ------------------------------------------------------------
    import { Na__FpCfg__GetCameraSetup } from '../../42__System__FloorPlanViews/Na__FloorPlan__ConfigState__.js';
    import { Na__FpData__GetCutHeightMm, Na__FpData__GetViewDepthMm, Na__FpData__GetSavedView } from '../../42__System__FloorPlanViews/Na__FloorPlan__ProjectJson__Data__.js';
    import { Na__ElevCfg__GetCameraSetup } from '../../45__System__ElevationViews/Na__Elevation__ConfigState__.js';
    import {
        Na__ElevData__GetAxes,
        Na__ElevData__IsSection,
        Na__ElevData__GetPlaneDistanceMm,
        Na__ElevData__GetViewDepthMm,
        Na__ElevData__GetSavedView
    } from '../../45__System__ElevationViews/Na__Elevation__ProjectJson__Data__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Scene Pose, Visibility, Sections, Tiled Renderer
    // ------------------------------------------------------------
    import { Na__PresentationMode__Camera__ApplySceneCameraState } from '../../21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js';
    import { Na__ModelToggle__CaptureVisibilityMap, Na__ModelToggle__ApplySceneLayerVisibility, Na__ModelToggle__SetCategoryVisibility, Na__ModelToggle__SetCategoryVisibleByKey, Na__ModelToggle__BorrowRegistry, Na__ModelToggle__RestoreRegistry } from '../../26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js';
    import { Na__SectSerialize__Serialize, Na__SectSerialize__Apply } from '../../41__System__SectionCutEngine/Na__SectionCut__Serialize__.js';
    import { Na__StaticExport__RenderToCanvas } from '../../30__System__ImageExport/Na__ImageExport__StaticExport__TiledRenderer.js';
    import { Na__PlView__KIND_PLAN, Na__PlView__Hash } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__ViewDefinition__.js';
    import { Na__PlStage__Describe } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__ModelStage__.js';
    import { Na__PlDoors__Apply, Na__PlDoors__Restore } from '../../50__System__ProjectedLinework/Na__ProjectedLinework__DoorPose__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Two Screen-Space Line Widths a Composite Weight Sets
    // ------------------------------------------------------------
    import { Na__DrawProfile__SetEdgeWidth, Na__DrawProfile__InvalidateSceneCache } from '../../40__System__DrawingViewCore/Na__DrawView__ProfileLines__.js';
    import { Na__SectCutCfg__GetAppearance, Na__SectCutCfg__SetAppearance } from '../../41__System__SectionCutEngine/Na__SectionCut__ConfigState__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Design Phases: the Library, and the Section Engine a Borrowed Model Is Handed To
    // ------------------------------------------------------------
    import {
        Na__PhaseLib__CHANGED_EVENT,
        Na__PhaseLib__IsLive,
        Na__PhaseLib__GetReadyEntry,
        Na__PhaseLib__Pin,
        Na__PhaseLib__Unpin
    } from '../../26__System__ToggleModelElements/Na__ModelGroup__PhaseLibrary__.js';
    import { Na__SectionCut__SetModelRoot } from '../../41__System__SectionCutEngine/Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Cut Plane Id
    // ------------------------------------------------------------
    const Na__LeSnap__CUT_ID     = 'na-layouteditor-snapshot';
    const Na__LeSnap__PHASE_HOLD = 'layout-editor-phase';   // <-- Render loop hold while a design phase stands in for the live model
    // ------------------------------------------------------------

    // MODULE VARIABLES | Render Context and Queue
    // ------------------------------------------------------------
    let Na__LeSnap__Renderer    = null;
    let Na__LeSnap__Scene       = null;
    let Na__LeSnap__Camera      = null;
    let Na__LeSnap__Controls    = null;
    let Na__LeSnap__PipelineRef = null;
    let Na__LeSnap__ModelRoot   = null;
    let Na__LeSnap__Ortho       = null;
    let Na__LeSnap__Chain       = Promise.resolve();
    let Na__LeSnap__ModelFp     = null;    // <-- Visibility-free model fingerprint, cached until the model or its toggles change
    let Na__LeSnap__PipelineFp  = null;    // <-- The projection pipeline's own fingerprint, cached the same way
    const Na__LeSnap__PhaseFp   = new Map();   // <-- groupId -> { model, pipeline }: the same pair for each design phase held off-scene
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Queue a Render Behind Any Other
    // ------------------------------------------------------------
    function Na__LeSnap__Enqueue(task) {
        const run = Na__LeSnap__Chain.then(task);
        Na__LeSnap__Chain = run.catch(() => {});
        return run;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Live Pipeline State
    // ------------------------------------------------------------
    function Na__LeSnap__Pipeline() {
        return Na__LeSnap__PipelineRef ? Na__LeSnap__PipelineRef.current : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Module's Own Orthographic Camera, Framed on a Window
    // ------------------------------------------------------------
    // window: { CentreX, CentreY, WidthMm, HeightMm } in drawing millimetres
    // ------------------------------------------------------------
    function Na__LeSnap__FrameOrtho(definition, windowMm) {
        if (!Na__LeSnap__Ortho) {
            Na__LeSnap__Ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
            Na__LeSnap__Ortho.name = 'Na__LayoutEditor__SnapshotCamera';
        }
        const camera = Na__LeSnap__Ortho;
        const halfW  = Na__Math__ConvertMmToUnits(windowMm.WidthMm  / 2);
        const halfH  = Na__Math__ConvertMmToUnits(windowMm.HeightMm / 2);
        camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
        camera.zoom = 1;

        if (definition.Kind === Na__PlView__KIND_PLAN) {
            const setup = Na__FpCfg__GetCameraSetup();
            const eyeX  = Na__Math__ConvertMmToUnits(windowMm.CentreX);
            const eyeZ  = Na__Math__ConvertMmToUnits(windowMm.CentreY);           // <-- Drawing y down is world Z
            const eyeY  = Na__Math__ConvertMmToUnits(Na__FpData__GetCutHeightMm(definition.Record)) + setup.heightAboveCutUnits;
            camera.near = setup.nearUnits; camera.far = setup.farUnits;
            camera.position.set(eyeX, eyeY, eyeZ);
            camera.up.set(0, 0, -1);
            camera.lookAt(eyeX, eyeY - 1, eyeZ);
        } else {
            const setup  = Na__ElevCfg__GetCameraSetup();
            const axes   = Na__ElevData__GetAxes(definition.Record);
            const runU   = Na__Math__ConvertMmToUnits(windowMm.CentreX);
            const height = Na__Math__ConvertMmToUnits(-windowMm.CentreY);          // <-- Drawing y down is minus height
            const planeU = Na__Math__ConvertMmToUnits(Na__ElevData__GetPlaneDistanceMm(definition.Record));
            const eyeD   = planeU + setup.standOffUnits;
            camera.near = setup.nearUnits; camera.far = setup.farUnits;
            camera.position.set((axes.rightX * runU) + (axes.normalX * eyeD), height, (axes.rightZ * runU) + (axes.normalZ * eyeD));
            camera.up.set(0, 1, 0);
            camera.lookAt((axes.rightX * runU) + (axes.normalX * planeU), height, (axes.rightZ * runU) + (axes.normalZ * planeU));
        }
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        return camera;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Drawing's Cut on the Section Adapter
    // ------------------------------------------------------------
    function Na__LeSnap__ApplyCut(definition) {
        const record = definition.Record;
        if (definition.Kind === Na__PlView__KIND_PLAN) {
            Na__DrawView__SectionAdapter__UpsertHorizontalPlane(Na__LeSnap__CUT_ID, Na__FpData__GetCutHeightMm(record), Na__FpData__GetViewDepthMm(record));
            Na__DrawView__SectionAdapter__SetActivePlane(Na__LeSnap__CUT_ID);
            return true;
        }
        if (!Na__ElevData__IsSection(record)) return false;
        const axes = Na__ElevData__GetAxes(record);
        Na__DrawView__SectionAdapter__UpsertVerticalPlane(Na__LeSnap__CUT_ID, axes.normalX, axes.normalZ, Na__ElevData__GetPlaneDistanceMm(record), Na__ElevData__GetViewDepthMm(record));
        Na__DrawView__SectionAdapter__SetActivePlane(Na__LeSnap__CUT_ID);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Render Context
    // ------------------------------------------------------------
    function Na__LeSnap__Initialize(context) {
        if (!context || !context.renderer || !context.scene || !context.camera) return false;
        Na__LeSnap__Renderer    = context.renderer;
        Na__LeSnap__Scene       = context.scene;
        Na__LeSnap__Camera      = context.camera;
        Na__LeSnap__Controls    = context.controls || null;
        Na__LeSnap__PipelineRef = context.pipelineRef || null;
        Na__LeSnap__ModelRoot   = context.modelRoot || null;
        Na__LeSnap__ResetFingerprints();
        window.addEventListener('na-model-visibility-changed', Na__LeSnap__ResetFingerprints);   // <-- Toggles change what a drawing shows
        window.addEventListener(Na__PhaseLib__CHANGED_EVENT, Na__LeSnap__OnPhaseChanged);         // <-- A design phase loaded, went, or moved into the 3D view
        return true;
    }
    function Na__LeSnap__IsReady() { return !!Na__LeSnap__Renderer; }
    // ------------------------------------------------------------


    // FUNCTION | The Model Root a Viewport Is Drawn From
    // ------------------------------------------------------------
    // modelSourceId null (or the phase the 3D view holds) is the live model
    // root; another design phase is its own off-scene root, or null while it
    // is not loaded.
    // ------------------------------------------------------------
    function Na__LeSnap__GetModelRoot(modelSourceId) {
        if (!modelSourceId || Na__PhaseLib__IsLive(modelSourceId)) return Na__LeSnap__ModelRoot;
        const entry = Na__PhaseLib__GetReadyEntry(modelSourceId);
        return entry ? entry.root : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Visibility-Free Model Fingerprint of a Described Model
    // ------------------------------------------------------------
    // Names, triangle counts and - where the loader stamped them - what the
    // GLBs under each category held. Counts alone cannot see a thing that
    // moved. The stamp is appended only where there is one, so a model loaded
    // without stamps keeps the key it always had.
    // ------------------------------------------------------------
    function Na__LeSnap__ModelHash(described) {
        return Na__PlView__Hash(JSON.stringify(described.Categories.map((c) => (c.stamp ? [ c.name, c.tris, c.stamp ] : [ c.name, c.tris ]))));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Design Phase's Two Fingerprints, Read While It Is at Rest
    // ------------------------------------------------------------
    // Returns { model, pipeline }, or null while the phase is not loaded - formed
    // exactly as the live pair below, so a phase's keys mean what the live
    // model's do.
    //
    // READ ONLY WHILE NO RENDER HAS THE PHASE. Describe counts each category's
    // visibility, and a render hides categories for its viewport; a fingerprint
    // taken mid-render would be held with those hides in it and would key every
    // later picture of the phase wrongly. So a phase is read the moment it loads
    // (OnPhaseChanged), before anything can have touched it, and a pinned phase
    // with nothing held yet answers null until it is free.
    // ------------------------------------------------------------
    function Na__LeSnap__PhaseFingerprints(groupId) {
        const held = Na__LeSnap__PhaseFp.get(groupId);
        if (held) return held;
        const entry = Na__PhaseLib__GetReadyEntry(groupId);
        if (!entry || entry.pins > 0) return null;
        const described = Na__PlStage__Describe(entry.root);
        const fingerprints = {
            model    : Na__LeSnap__ModelHash(described),
            pipeline : described.Fingerprint
        };
        Na__LeSnap__PhaseFp.set(groupId, fingerprints);
        return fingerprints;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep the Fingerprints in Step With the Phase Library
    // ------------------------------------------------------------
    // A newly loaded phase is read at once; a phase let go is forgotten. When
    // the 3D view takes a different phase, the live pair is read again: before
    // v2.31 nothing reset it on a Design Phase switch, so every viewport kept
    // keys made from the model that had been replaced.
    // ------------------------------------------------------------
    function Na__LeSnap__OnPhaseChanged(event) {
        const detail = (event && event.detail) || {};
        if (detail.kind === 'ready' && detail.groupId) {
            Na__LeSnap__PhaseFp.delete(detail.groupId);
            Na__LeSnap__PhaseFingerprints(detail.groupId);
        } else if (detail.kind === 'evicted' && detail.groupId) {
            Na__LeSnap__PhaseFp.delete(detail.groupId);
        } else if (detail.kind === 'groups') {
            Na__LeSnap__PhaseFp.clear();
        }
        if (detail.kind === 'live' || detail.kind === 'groups') Na__LeSnap__ResetFingerprints();
    }
    // ------------------------------------------------------------


    // FUNCTION | Model Fingerprints, Computed Once and Held Until the Model Changes
    // ------------------------------------------------------------
    // Describing the model walks every mesh, so the viewports must not ask
    // for it on every refresh. The model one ignores category visibility
    // (a snapshot re-reads the scene's own layer map); the pipeline one is
    // exactly what the projection cache keys use.
    //
    // modelSourceId asks for a design phase held off-scene instead of the live
    // model, and answers null while that phase is not loaded.
    // ------------------------------------------------------------
    function Na__LeSnap__GetModelFingerprint(modelSourceId) {
        if (modelSourceId && !Na__PhaseLib__IsLive(modelSourceId)) {
            const held = Na__LeSnap__PhaseFingerprints(modelSourceId);
            return held ? held.model : null;
        }
        if (Na__LeSnap__ModelFp === null) {
            const described = Na__PlStage__Describe(Na__LeSnap__ModelRoot);
            Na__LeSnap__ModelFp = Na__LeSnap__ModelHash(described);
        }
        return Na__LeSnap__ModelFp;
    }
    function Na__LeSnap__GetPipelineFingerprint(modelSourceId) {
        if (modelSourceId && !Na__PhaseLib__IsLive(modelSourceId)) {
            const held = Na__LeSnap__PhaseFingerprints(modelSourceId);
            return held ? held.pipeline : null;
        }
        if (Na__LeSnap__PipelineFp === null) Na__LeSnap__PipelineFp = Na__PlStage__Describe(Na__LeSnap__ModelRoot).Fingerprint;
        return Na__LeSnap__PipelineFp;
    }
    function Na__LeSnap__ResetFingerprints() {
        Na__LeSnap__ModelFp    = null;
        Na__LeSnap__PipelineFp = null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a Drawing's Content Is, in Drawing Millimetres
    // ------------------------------------------------------------
    // The author's saved framing when there is one, else the model's centre.
    // ------------------------------------------------------------
    function Na__LeSnap__DrawingCentreMm(definition) {
        const record = definition.Record;
        const box    = Na__LeSnap__ModelRoot ? new THREE.Box3().setFromObject(Na__LeSnap__ModelRoot) : null;
        const centre = (box && !box.isEmpty()) ? box.getCenter(new THREE.Vector3()) : null;
        if (definition.Kind === Na__PlView__KIND_PLAN) {
            const saved = Na__FpData__GetSavedView(record);
            if (saved.targetXMm !== null && saved.targetZMm !== null) return { x : saved.targetXMm, y : saved.targetZMm };
            return centre ? { x : Na__Math__ConvertUnitsToMm(centre.x), y : Na__Math__ConvertUnitsToMm(centre.z) } : { x : 0, y : 0 };
        }
        const saved = Na__ElevData__GetSavedView(record);
        if (saved.runMm !== null && saved.heightMm !== null) return { x : saved.runMm, y : -saved.heightMm };
        if (!centre) return { x : 0, y : 0 };
        const axes = Na__ElevData__GetAxes(record);
        const run  = (centre.x * axes.rightX) + (centre.z * axes.rightZ);
        return { x : Na__Math__ConvertUnitsToMm(run), y : -Na__Math__ConvertUnitsToMm(centre.y) };
    }
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Model Categories a Drawing Calls Context
    // ------------------------------------------------------------
    // Everything that is not the design itself: what the proposal stands in
    // and against. The proposal, its doors and the interior dressing are
    // never touched.
    // ------------------------------------------------------------
    const Na__LeSnap__CONTEXT_CATEGORIES = [
        'TrueVision__MainBuildingModel__Existing',
        'TrueVision__SiteBoundaries',
        'TrueVision__LandscapeEnvironment',
        'TrueVision__Vegetation',
        'TrueVision__SiteVegetation2D',
        'TrueVision__SceneEntourage2D',
        'TrueVision__SceneContextual'
    ];
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take Out of the Picture Whatever This Viewport Hides
    // ------------------------------------------------------------
    // Two rules, one capture. Context Layer off removes the whole surrounding
    // set in one gesture; the Model Layers panel removes named categories one
    // at a time. They compose - a viewport can drop the context AND the
    // proposal's furniture - and the single captured map puts all of it back.
    //
    // Returns the visibility map to restore afterwards, or null when the
    // viewport hides nothing and the scene was never touched. Capturing
    // nothing in that case matters: the capture walks every loaded category,
    // and most viewports hide nothing at all.
    // ------------------------------------------------------------
    function Na__LeSnap__HideForViewport(styles, modelLayers) {
        const wantsContext = !!styles && styles.contextLayer === false;
        const hidden       = modelLayers ? Object.keys(modelLayers).filter((key) => modelLayers[key] === false) : [];
        if (!wantsContext && hidden.length === 0) return null;

        const saved = Na__ModelToggle__CaptureVisibilityMap();
        if (wantsContext) Na__LeSnap__CONTEXT_CATEGORIES.forEach((key) => Na__ModelToggle__SetCategoryVisibility(key, false));
        hidden.forEach((key) => Na__ModelToggle__SetCategoryVisibleByKey(key, false));   // <-- Exact keys: see the note on that setter
        return saved;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Set the Width of the Model's Own Edges for One Render
    // ------------------------------------------------------------
    // The Base Image composite weight. These are the SketchUp edges the loader
    // upgraded to fat lines under every root it tagged Na__ModelType 'linework',
    // which otherwise draw at RenderConfig__Linework__LineWidth for as long as
    // the model is loaded. A fat line resolves its width against the renderer's
    // viewport on every draw, so inside a tiled render this is a true pixel
    // count in the tile - the same kind of number as the section outline's.
    //
    // Returns the width each material held, for the finally to hand back one
    // by one, or null when there was nothing to set. The cut outline is a fat
    // line too but sits under no linework root, so it keeps the Section
    // Outline weight instead of being flattened to this one.
    // ------------------------------------------------------------
    function Na__LeSnap__SetModelEdgeWidth(widthPx, modelRoot) {
        const from = modelRoot || Na__LeSnap__ModelRoot;                          // <-- The design phase in the scene for this render, else the live model
        if (!from || !Number.isFinite(widthPx) || widthPx <= 0) return null;
        const held = new Map();
        from.traverse((root) => {
            if (!root.userData || root.userData.Na__ModelType !== 'linework') return;
            root.traverse((node) => {
                if (!node.isLineSegments2 || !node.material || held.has(node.material)) return;
                held.set(node.material, node.material.linewidth);
                node.material.linewidth = widthPx;
            });
        });
        return held.size > 0 ? held : null;
    }
    function Na__LeSnap__RestoreModelEdgeWidth(held) {
        if (held) held.forEach((width, material) => { material.linewidth = width; });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move a Child to an Index Among Its Siblings
    // ------------------------------------------------------------
    function Na__LeSnap__MoveChild(parent, child, index) {
        const at = parent.children.indexOf(child);
        if (index < 0 || at === -1 || at === index) return;
        parent.children.splice(at, 1);
        parent.children.splice(Math.min(index, parent.children.length), 0, child);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop the Two Profile Line Caches of Scene Objects
    // ------------------------------------------------------------
    function Na__LeSnap__InvalidateSceneCaches() {
        Na__DrawProfile__InvalidateSceneCache();                                  // <-- The 2D silhouette pass
        const pipeline = Na__LeSnap__Pipeline();
        if (pipeline && typeof pipeline.invalidateProfileLinesCache === 'function') pipeline.invalidateProfileLinesCache();   // <-- The composer's, for 3D snapshots
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Design Phase in the Scene for One Render
    // ------------------------------------------------------------
    // Returns the stage for ExitPhase, or null when there is nothing to do: no
    // source, the phase the 3D view already holds, or a phase not loaded.
    //
    // THE LIVE MODEL LEAVES THE SCENE; IT IS NOT HIDDEN. A hidden root is still
    // walked by everything that walks the scene - both profile line caches, a
    // bounding box - so the scene is made to hold exactly one model, the phase,
    // and every pass meets only that. The live root keeps its children, so the
    // projection pipeline reading it meanwhile still reads the live model.
    //
    // FOUR THINGS HOLD THE MODEL AND ARE HANDED THE PHASE: the section engine
    // (clip planes and caps), the material preset (whitecard, opaque glass), the
    // category registry (Context Layer, Model Layers, a scene's layer map) and
    // the profile line caches. The render loop is held throughout, so no live
    // frame can ever draw the phase in the 3D view's place.
    // ------------------------------------------------------------
    function Na__LeSnap__EnterPhase(modelSourceId) {
        if (!modelSourceId || Na__PhaseLib__IsLive(modelSourceId)) return null;
        const live  = Na__LeSnap__ModelRoot;
        const scene = Na__LeSnap__Scene;
        const entry = (live && scene) ? Na__PhaseLib__Pin(modelSourceId) : null;
        if (!entry) return null;

        const stage = { groupId : modelSourceId, root : entry.root, liveIndex : scene.children.indexOf(live), liveVisibility : Na__ModelToggle__CaptureVisibilityMap(), registry : null };
        Na__RenderLoop__Pause(Na__LeSnap__PHASE_HOLD);
        try {
            if (stage.liveIndex !== -1) scene.remove(live);
            scene.add(entry.root);
            Na__LeSnap__MoveChild(scene, entry.root, stage.liveIndex);             // <-- Where the live model was, so render order is unchanged
            stage.registry = Na__ModelToggle__BorrowRegistry(entry.groups);
            Na__DrawView__MaterialPreset__SetModelRoot(entry.root);
            Na__SectionCut__SetModelRoot(entry.root);
            Na__LeSnap__InvalidateSceneCaches();
            return stage;
        } catch (stageError) {
            console.warn('[TrueVision3D LayoutEditor] Design phase could not be put in the scene:', stageError);
            Na__LeSnap__ExitPhase(stage);
            return null;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hand the Scene Back to the Live Model
    // ------------------------------------------------------------
    // Undoes EnterPhase from any point it reached. The live category flags are
    // put back from the capture taken on entry: a scene's visibility block
    // resets the storey system too, and that reaches the live model's groups
    // even while the phase holds the registry.
    // ------------------------------------------------------------
    function Na__LeSnap__ExitPhase(stage) {
        if (!stage) return;
        const live  = Na__LeSnap__ModelRoot;
        const scene = Na__LeSnap__Scene;
        try {
            if (stage.root.parent === scene) scene.remove(stage.root);
            if (live && stage.liveIndex !== -1 && live.parent !== scene) {
                scene.add(live);
                Na__LeSnap__MoveChild(scene, live, stage.liveIndex);
            }
            if (stage.registry) Na__ModelToggle__RestoreRegistry(stage.registry);
            Na__ModelToggle__ApplySceneLayerVisibility(stage.liveVisibility);
            stage.root.children.forEach((category) => { category.visible = true; });   // <-- At rest a phase shows everything; its fingerprint was read so
            Na__DrawView__MaterialPreset__SetModelRoot(live);
            Na__SectionCut__SetModelRoot(live);                                        // <-- The live clip planes, and the caps of any cut the 3D view holds
            Na__LeSnap__InvalidateSceneCaches();
        } finally {
            Na__PhaseLib__Unpin(stage.groupId);
            Na__RenderLoop__Resume(Na__LeSnap__PHASE_HOLD);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Render a 2D Drawing Window Offscreen
    // ------------------------------------------------------------
    // Returns { dataUrl, widthPx, heightPx } (png), or null. modelLayers is the
    // viewport's Viewport__ModelLayers map, or null for a viewport showing
    // everything the model has.
    //
    // weights is { profilePx, sectionPx, modelEdgePx } from the viewport's Render
    // Composites, or null for the configured widths. All three are SCREEN-SPACE
    // widths - the Sobel sampling offset, the cut outline's line material and
    // the model's own edge materials - so they are set for the length of this
    // one render and put back afterwards, exactly like the profile pass's
    // enabled flag already is.
    //
    // modelSourceId is the design phase drawn (a viewport's Model Source
    // renderId), null for the model the 3D view holds. A phase that is not
    // loaded when the render's turn comes draws nothing - null - never the
    // wrong model.
    //
    // stillWanted: optional. Asked when this render's turn in the queue comes;
    // false answers null and nothing is drawn (a viewport whose sheet has been
    // left meanwhile). The PDF and the forced renders never pass it.
    // ------------------------------------------------------------
    function Na__LeSnap__Render2d(definition, windowMm, styles, widthPx, heightPx, modelLayers, antiAliasSamples, weights, modelSourceId, stillWanted) {
        if (!Na__LeSnap__IsReady() || !definition) return Promise.resolve(null);
        return Na__LeSnap__Enqueue(async () => {
            if (typeof stillWanted === 'function' && !stillWanted()) return null;  // <-- Nobody is waiting for it any more: the queue moves on
            const phase = Na__LeSnap__EnterPhase(modelSourceId);                  // <-- First: the cut, the presets and the hides below all meet this model
            if (modelSourceId && !phase && !Na__PhaseLib__IsLive(modelSourceId)) return null;
            const wasSuspended = Na__DrawView__Transitions__IsSuspended();
            const pipeline     = Na__LeSnap__Pipeline();
            const pass         = pipeline && pipeline.profileLinesPassRef ? pipeline.profileLinesPassRef : null;
            const passWasOn    = pass ? pass.enabled : null;                       // <-- The preset's exit forces it on; the 3D toggle owns it
            let cutApplied = false;
            let contextSaved = null;                                               // <-- Visibility to put back when the context was hidden
            const wantProfile = weights && Number.isFinite(weights.profilePx) && weights.profilePx > 0;
            const wantSection = weights && Number.isFinite(weights.sectionPx) && weights.sectionPx > 0;
            const sectionWas  = wantSection ? Na__SectCutCfg__GetAppearance().lineWidthPx : null;
            let   profileWas  = null;
            let   edgesWere   = null;                                              // <-- Each model edge material's own width, for the finally
            let   doorsPosed  = null;                                              // <-- The drawing's door pose, for the finally to hand back
            try {
                Na__DrawView__SectionAdapter__SuspendLiveTool();
                // THE DOORS STAND AS THE DRAWING DRAWS THEM - open on a plan, shut on
                // an elevation or section - before anything reads the model, so the
                // cut's caps and the picture both meet the posed leaves and the base
                // image agrees with the linework over it.
                if (definition.DoorPose) doorsPosed = Na__PlDoors__Apply(phase ? phase.root : Na__LeSnap__ModelRoot, definition.DoorPose);
                // THE OUTLINE WIDTH GOES IN BEFORE THE CUT IS BUILT. The cap
                // meshes read it when they are created, so setting it after
                // ApplyCut would draw this viewport at whatever width the last
                // one left behind.
                if (wantSection) Na__SectCutCfg__SetAppearance({ lineWidthPx : weights.sectionPx });
                cutApplied = Na__LeSnap__ApplyCut(definition);
                const camera = Na__LeSnap__FrameOrtho(definition, windowMm);
                if (!wasSuspended) Na__DrawView__Transitions__SuspendThreeD();     // <-- Distance culling off for the picture
                Na__DrawView__RenderPreset__Enter({ camera : camera, styles : styles || {} });
                // AND THE PROFILE WIDTH GOES IN AFTER THE PRESET. Enter applies
                // the drawing's configured width as part of its styles, so an
                // override set any earlier is simply overwritten. SetEdgeWidth
                // with a non-number changes nothing and answers the current
                // width, which is the value to hand back afterwards.
                if (wantProfile) {
                    profileWas = Na__DrawProfile__SetEdgeWidth(NaN);
                    Na__DrawProfile__SetEdgeWidth(weights.profilePx);
                }
                if (weights) edgesWere = Na__LeSnap__SetModelEdgeWidth(weights.modelEdgePx, phase ? phase.root : null);   // <-- No preset touches a line material, so where this sits is free
                Na__DrawView__MaterialPreset__Enter(styles || {});
                contextSaved = Na__LeSnap__HideForViewport(styles, modelLayers);
                Na__DrawView__SectionAdapter__ReapplyClipping();
                // THE ORTHO CAMERA GOES IN HERE, not the main one. ValeVision
                // passes Na__LeSnap__Camera at this point and is right to: its
                // ComposerPreset swaps the composer's RenderPass camera to the
                // framed ortho, so the render uses the ortho regardless and this
                // argument only feeds the view-offset maths.
                //
                // TrueVision has no composer in the drawing path (DIV-1), so
                // nothing else is holding the ortho camera and whatever is
                // passed here is what actually draws. Passing the main camera
                // renders the live 3D view into the viewport at whatever the
                // user was looking at - which is a picture, at no scale at all,
                // that looks enough like a drawing to be believed.
                const result = await Na__StaticExport__RenderToCanvas({
                    renderer : Na__LeSnap__Renderer, scene : Na__LeSnap__Scene, camera : camera,
                    getRenderPipelineState : () => Na__LeSnap__Pipeline(),
                    elevationOverrides     : Na__DrawView__RenderPreset__GetExportOverrides(),
                    renderFrame            : (cam) => Na__DrawView__RenderPreset__RenderFrame(cam),   // <-- Flat render + silhouette + cut, the screen's exact order
                    antiAliasSamples       : antiAliasSamples,                                        // <-- Each tile drawn N times on sub-pixel jitter and averaged
                    targetWidth : Math.max(16, Math.round(widthPx)), targetHeight : Math.max(16, Math.round(heightPx))
                });
                if (styles && styles.enhanceWhitecard === true) await Na__LeEnhance__Apply(result.canvas);   // <-- Levels and sharpen: the whitecard greys go to paper white
                return { dataUrl : result.canvas.toDataURL('image/png'), widthPx : result.width, heightPx : result.height };
            } catch (renderError) {
                console.warn('[TrueVision3D LayoutEditor] 2D underlay render failed:', renderError);
                return null;
            } finally {
                if (contextSaved) Na__ModelToggle__ApplySceneLayerVisibility(contextSaved);
                Na__DrawView__MaterialPreset__Exit();
                Na__DrawView__RenderPreset__Exit();
                Na__LeSnap__RestoreModelEdgeWidth(edgesWere);                                        // <-- The live 3D view keeps the loader's edge width
                if (profileWas !== null) Na__DrawProfile__SetEdgeWidth(profileWas);                 // <-- The next viewport or drawing starts from the configured width
                if (pass && passWasOn !== null) pass.enabled = passWasOn;
                if (cutApplied) Na__DrawView__SectionAdapter__RemovePlane(Na__LeSnap__CUT_ID);
                if (sectionWas !== null) Na__SectCutCfg__SetAppearance({ lineWidthPx : sectionWas });
                Na__DrawView__SectionAdapter__Release();
                Na__PlDoors__Restore(doorsPosed);                                                    // <-- The doors back where the 3D view holds them, before the phase leaves
                if (!wasSuspended) Na__DrawView__Transitions__ResumeThreeD();
                Na__RenderLoop__RequestRender();
                Na__LeSnap__ExitPhase(phase);                                                        // <-- Last: everything above is back on the model it came from
            }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Render a Saved Scene Offscreen With the Viewport's Styles
    // ------------------------------------------------------------
    // Returns { canvas, widthPx, heightPx }, or null. The caller converts.
    //
    // weights is { modelEdgePx } or null. The model's own edges are the one
    // composite width a scene render has: its profile outline is the composer's
    // own distance-scaled effect, and the Section Outline weight belongs to a 2D
    // drawing's cut.
    //
    // modelSourceId: as Render2d. The phase is put in before the capture below,
    // so the visibility captured and put back is the phase's own.
    //
    // viewWindow: null for the camera's whole picture, or { u0, v0, u1, v1 } -
    // the part of it a zoomed or slid 3D viewport's frame shows, as fractions
    // of the picture that may run past 0..1 (Na__LayoutEditor__Viewport3d__).
    // widthPx and heightPx are then the window's pixels, and the tiled renderer
    // draws that window of the scene's own camera.
    //
    // stillWanted: as Render2d.
    // ------------------------------------------------------------
    function Na__LeSnap__Render3d(sceneRecord, styles, widthPx, heightPx, modelLayers, antiAliasSamples, weights, modelSourceId, viewWindow, stillWanted) {
        if (!Na__LeSnap__IsReady() || !sceneRecord) return Promise.resolve(null);
        return Na__LeSnap__Enqueue(async () => {
            if (typeof stillWanted === 'function' && !stillWanted()) return null;  // <-- Nobody is waiting for it any more: the queue moves on
            const phase = Na__LeSnap__EnterPhase(modelSourceId);
            if (modelSourceId && !phase && !Na__PhaseLib__IsLive(modelSourceId)) return null;
            const camera   = Na__LeSnap__Camera;
            const controls = Na__LeSnap__Controls;
            const pipeline = Na__LeSnap__Pipeline();
            const pass     = pipeline && pipeline.profileLinesPassRef ? pipeline.profileLinesPassRef : null;
            const saved = {
                position   : camera.position.clone(),
                quaternion : camera.quaternion.clone(),
                fov        : camera.fov,
                zoom       : camera.zoom,
                target     : controls ? controls.target.clone() : null,
                visibility : Na__ModelToggle__CaptureVisibilityMap(),
                sections   : Na__SectSerialize__Serialize(),
                passOn     : pass ? pass.enabled : null
            };
            let edgesWere = null;
            try {
                Na__PresentationMode__Camera__ApplySceneCameraState(camera, controls, sceneRecord);
                Na__DrawView__MaterialPreset__Enter(styles || {});
                Na__LeSnap__HideForViewport(styles, modelLayers);                   // <-- The saved map above already puts it back
                if (pass) pass.enabled = !(styles && styles.profileLinework === false);
                if (weights) edgesWere = Na__LeSnap__SetModelEdgeWidth(weights.modelEdgePx, phase ? phase.root : null);
                // NO renderFrame HERE, ON PURPOSE. That absence is what puts a
                // 3D snapshot on the COMPOSER route, so it is drawn by the same
                // per-frame sequence the live viewport uses - profile lines,
                // ambient occlusion, fog and all. Until v2.25.0 the tiled
                // renderer ignored the pipeline and fell back to a bare
                // renderer.render, which is why this toggled a profile-lines
                // pass that never ran and why the base image under every 3D
                // viewport looked nothing like the screen it came from.
                const result = await Na__StaticExport__RenderToCanvas({
                    renderer : Na__LeSnap__Renderer, scene : Na__LeSnap__Scene, camera : camera,
                    getRenderPipelineState : () => Na__LeSnap__Pipeline(),
                    antiAliasSamples       : antiAliasSamples,                                        // <-- Each tile drawn N times on sub-pixel jitter and averaged
                    viewWindow             : viewWindow || null,                                      // <-- What a zoomed or slid viewport's frame shows of the picture; null is all of it
                    targetWidth : Math.max(16, Math.round(widthPx)), targetHeight : Math.max(16, Math.round(heightPx))
                });
                if (styles && styles.enhanceWhitecard === true) await Na__LeEnhance__Apply(result.canvas);
                return { canvas : result.canvas, widthPx : result.width, heightPx : result.height };
            } catch (renderError) {
                console.warn('[TrueVision3D LayoutEditor] 3D snapshot render failed:', renderError);
                return null;
            } finally {
                Na__DrawView__MaterialPreset__Exit();
                Na__LeSnap__RestoreModelEdgeWidth(edgesWere);
                if (pass && saved.passOn !== null) pass.enabled = saved.passOn;
                camera.position.copy(saved.position);
                camera.quaternion.copy(saved.quaternion);
                camera.fov  = saved.fov;
                camera.zoom = saved.zoom;
                camera.updateProjectionMatrix();
                if (controls && saved.target) { controls.target.copy(saved.target); controls.update(); }
                Na__ModelToggle__ApplySceneLayerVisibility(saved.visibility);
                Na__SectSerialize__Apply(saved.sections);
                Na__RenderLoop__RequestRender();
                Na__LeSnap__ExitPhase(phase);
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Snapshot Renderer API
    // ------------------------------------------------------------
    export {
        Na__LeSnap__Initialize,
        Na__LeSnap__IsReady,
        Na__LeSnap__GetModelRoot,
        Na__LeSnap__GetModelFingerprint,
        Na__LeSnap__GetPipelineFingerprint,
        Na__LeSnap__ResetFingerprints,
        Na__LeSnap__DrawingCentreMm,
        Na__LeSnap__Render2d,
        Na__LeSnap__Render3d
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
